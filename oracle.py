import json, sys, datetime, math, tomli
cases = json.load(sys.stdin)
out = []
for s in cases:
    try:
        v = tomli.loads('k = ' + s)['k']
    except Exception as e:
        out.append(['ERR', str(e)[:60]]); continue
    if isinstance(v, bool): out.append(['boolean', 'true' if v else 'false'])
    elif isinstance(v, int): out.append(['integer', str(v)])
    elif isinstance(v, float):
        out.append(['float', 'nan' if v != v else ('inf' if v == math.inf else ('-inf' if v == -math.inf else repr(v)))])
    elif isinstance(v, str): out.append(['string', v])
    elif isinstance(v, datetime.datetime):
        iso = v.isoformat(); out.append(['offset date-time' if v.tzinfo else 'local date-time', iso])
    elif isinstance(v, datetime.date): out.append(['local date', v.isoformat()])
    elif isinstance(v, datetime.time): out.append(['local time', v.isoformat()])
    else: out.append(['other', type(v).__name__])
json.dump(out, sys.stdout)
