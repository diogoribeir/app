"""Tolerant parser for Lua *data* literals (never executes code).
Tables -> dict (array part under int keys 1..n -> list when pure array),
SkillType.X -> "X", function bodies skipped, calls -> {"__call": name, "args": [...]}."""
import re
TOK = re.compile(r'''
 (?P<ws>\s+|--\[\[.*?\]\]|--[^\n]*)
|(?P<lstr>\[(?P<eq>=*)\[.*?\](?P=eq)\])
|(?P<str>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')
|(?P<num>0x[0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)
|(?P<name>[A-Za-z_][A-Za-z0-9_]*)
|(?P<op>\.\.\.|\.\.|==|~=|<=|>=|::|[{}\[\]()=,;.:+\-*/%^#<>])
''', re.S | re.X)
KW_OPEN = {'function', 'if', 'for', 'while', 'do'}
def tokenize(s):
    out = []; i = 0; n = len(s)
    while i < n:
        m = TOK.match(s, i)
        if not m: raise ValueError('bad char %r at %d' % (s[i], i))
        i = m.end(); k = m.lastgroup
        if k == 'ws': continue
        if k == 'eq': k = 'lstr'
        out.append((k if k != 'eq' else 'lstr', m.group(0)))
    return out
def unq(t):
    body = t[1:-1]
    return re.sub(r'\\(n|t|r|\\|"|\'|\d{1,3})', lambda m: {'n':'\n','t':'\t','r':'','\\':'\\','"':'"',"'":"'"}.get(m.group(1), chr(int(m.group(1))) if m.group(1).isdigit() else m.group(1)), body)
class P:
    def __init__(s, toks): s.t = toks; s.i = 0
    def peek(s, o=0): return s.t[s.i+o] if s.i+o < len(s.t) else (None, None)
    def nxt(s): v = s.t[s.i]; s.i += 1; return v
    def skip_function(s):
        # at token after 'function'; skip to matching 'end'
        depth = 1
        while depth:
            k, v = s.nxt()
            if k == 'name':
                if v in KW_OPEN:
                    # 'do' after for/while is part of same block
                    if v == 'do' and s._loop_pending: s._loop_pending -= 1; continue
                    if v in ('for', 'while'): s._loop_pending += 1
                    depth += 1
                elif v == 'end': depth -= 1
                elif v == 'repeat': depth += 1
                elif v == 'until': depth -= 1
        return {'__function': True}
    _loop_pending = 0
    def value(s):
        k, v = s.peek()
        if k == 'op' and v == '{': return s.table()
        if k == 'str': s.nxt(); return s.postfix(unq(v))
        if k == 'lstr': s.nxt(); return re.sub(r'^\[=*\[\n?|\]=*\]$', '', v)
        if k == 'num': s.nxt(); return s.arith(float(v) if any(c in v for c in '.eE') else int(v, 0))
        if k == 'op' and v == '-':
            s.nxt(); x = s.value(); return -x if isinstance(x, (int, float)) else x
        if k == 'op' and v == '#': s.nxt(); s.value(); return None
        if k == 'op' and v == '(':
            s.nxt(); x = s.value(); s.expect(')'); return s.postfix(x)
        if k == 'name':
            s.nxt()
            if v == 'true': return True
            if v == 'false': return False
            if v == 'nil': return None
            if v == 'not': s.value(); return None
            if v == 'function':
                s._loop_pending = 0; return s.skip_function()
            name = v
            while s.peek() == ('op', '.') or s.peek() == ('op', ':'):
                s.nxt(); name += '.' + s.nxt()[1]
            return s.postfix(name.split('.')[-1] if name.startswith('SkillType.') else {'__ref': name} if '(' != s.peek()[1] and not name.startswith('SkillType') else name)
        raise ValueError('unexpected %r %r at %d' % (k, v, s.i))
    def postfix(s, x):
        while True:
            k, v = s.peek()
            if k == 'op' and v == '(':
                s.nxt(); args = []
                while s.peek() != ('op', ')'):
                    args.append(s.value())
                    if s.peek() == ('op', ','): s.nxt()
                s.nxt(); x = {'__call': x if isinstance(x, str) else str(x), 'args': args}
            elif k == 'op' and v in ('..', '+', '-', '*', '/', '%', '^', '==', '~=', '<', '>', '<=', '>=') or (k == 'name' and v in ('and', 'or')):
                s.nxt(); y = s.value()
                x = s.combine(x, v, y)
            elif k == 'op' and v == '[':
                s.nxt(); s.value(); s.expect(']')
            elif k == 'op' and v == '.' :
                s.nxt(); s.nxt()
            else:
                return x
    def arith(s, x): return s.postfix(x)
    def combine(s, x, op, y):
        try:
            if op == '..': return str(x) + str(y)
            if isinstance(x, (int, float)) and isinstance(y, (int, float)):
                return {'+': x+y, '-': x-y, '*': x*y, '/': x/y if y else 0, '%': x % y if y else 0, '^': x**y}.get(op, None)
        except Exception: pass
        return None
    def expect(s, v):
        k, w = s.nxt()
        if w != v: raise ValueError('expected %s got %s at %d' % (v, w, s.i))
    def table(s):
        s.expect('{'); d = {}; arr = []
        while s.peek() != ('op', '}'):
            k, v = s.peek()
            if k == 'op' and v == '[':
                s.nxt(); key = s.value(); s.expect(']'); s.expect('='); d[key] = s.value()
            elif k == 'name' and s.peek(1) == ('op', '='):
                s.nxt(); s.nxt(); d[v] = s.value()
            else:
                arr.append(s.value())
            if s.peek() in (('op', ','), ('op', ';')): s.nxt()
        s.nxt()
        if arr and not d: return arr
        for i, a in enumerate(arr): d[i+1] = a
        return d
def parse_return_table(src):
    toks = tokenize(src); p = P(toks)
    while p.peek() != ('name', 'return'): p.nxt()
    p.nxt(); return p.value()
def parse_assignments(src, prefix):
    """Find `prefix["Key"] = { ... }` statements (e.g. skills["X"] = {...})."""
    toks = tokenize(src); p = P(toks); out = {}
    while p.i < len(toks):
        k, v = p.peek()
        if k == 'name' and v == prefix and p.peek(1) == ('op', '[') and p.peek(3) == ('op', ']') and p.peek(4) == ('op', '='):
            p.nxt(); p.nxt(); key = unq(p.nxt()[1]); p.nxt(); p.nxt()
            out[key] = p.value()
        else:
            p.nxt()
    return out
