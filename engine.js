(function (root) {
  'use strict';
  // TOML v1.0.0 scalar values (toml.io/en/v1.0.0): integers, floats, booleans, date-times and single-line strings.
  var D = '[0-9]', DEC = '(?:0|[1-9](?:_?[0-9])*)';
  var RE_INT = new RegExp('^[+-]?' + DEC + '$'), RE_HEX = /^0x[0-9a-fA-F](?:_?[0-9a-fA-F])*$/, RE_OCT = /^0o[0-7](?:_?[0-7])*$/, RE_BIN = /^0b[01](?:_?[01])*$/;
  var RE_FLOAT = new RegExp('^[+-]?' + DEC + '(?:\\.[0-9](?:_?[0-9])*(?:[eE][+-]?[0-9](?:_?[0-9])*)?|[eE][+-]?[0-9](?:_?[0-9])*)$');
  var RE_SPECIAL = /^[+-]?(inf|nan)$/;
  var RE_DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
  var RE_TIME = /^([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]+))?$/;
  var MIN = -(2n ** 63n), MAX = 2n ** 63n - 1n;
  function leap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function fail(m) { return { ok: false, error: m }; }
  function diagnose(s) {
    if (/^[+-]?0[0-9]/.test(s) && /^[+-]?[0-9_]+$/.test(s)) return 'Leading zeros are not allowed in decimal integers (0755 is not octal here; use 0o755).';
    if (/__|^_|_$|[0-9]_[^0-9]|[^0-9a-fA-F]_[0-9]/.test(s)) return 'Each underscore must have a digit on both sides.';
    if (/^[+-]0[xob]/.test(s)) return 'Hex, octal and binary numbers cannot have a + or - sign.';
    if (/^(\.[0-9]|[0-9]+\.($|[eE]))/.test(s)) return 'A decimal point needs at least one digit on each side (.7, 7. and 3.e+20 are invalid).';
    if (/^(True|False|TRUE|FALSE|Inf|NaN|INF|NAN)$/i.test(s)) return 'Booleans, inf and nan are lowercase only.';
    if (/^(yes|no|on|off|y|n|null|~|)$/i.test(s)) return 'TOML has no ' + (s || 'empty value') + ' literal. Booleans are true and false. Strings need quotes.';
    if (/^0x[0-9a-fA-F_]*$/.test(s) === false && /^0x/.test(s)) return 'Not valid hexadecimal digits.';
    if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}[T t][0-9]/.test(s) || /^[0-9]{2}:[0-9]{2}/.test(s)) return 'Not a valid RFC 3339 date or time (needs two-digit fields and valid values).';
    return 'Not a valid TOML value: a bare word is not allowed. Strings must be quoted.';
  }
  function parseTime(t) {
    var m = RE_TIME.exec(t); if (!m) return null; var h = +m[1], mi = +m[2], se = +m[3];
    if (h > 23 || mi > 59 || se > 59) return { error: 'Time fields out of range (hour 00-23, minute 00-59, second 00-59).' };
    var frac = m[4] ? m[4].slice(0, 6) : ''; while (frac.length < 6 && frac) frac += '0'; if (/^0*$/.test(frac)) frac = '';
    return { text: m[1] + ':' + m[2] + ':' + m[3] + (frac ? '.' + frac : ''), truncated: !!(m[4] && m[4].length > 6) };
  }
  function parseDate(d) {
    var m = RE_DATE.exec(d); if (!m) return null; var y = +m[1], mo = +m[2], da = +m[3];
    var dim = [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (mo < 1 || mo > 12 || da < 1 || da > dim[mo - 1]) return { error: 'Not a real calendar date.' };
    return { text: m[1] + '-' + m[2] + '-' + m[3] };
  }
  function unescapeBasic(body) {
    var out = '', i = 0;
    while (i < body.length) {
      var c = body[i];
      if (c === '\\') {
        var n = body[i + 1], map = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' };
        if (n in map) { out += map[n]; i += 2; continue; }
        if (n === 'u' || n === 'U') { var len = n === 'u' ? 4 : 8, hex = body.substr(i + 2, len);
          if (hex.length !== len || !/^[0-9a-fA-F]+$/.test(hex)) return { error: 'A \\' + n + ' escape needs exactly ' + len + ' hex digits.' };
          var cp = parseInt(hex, 16); if (cp > 0x10ffff || (cp >= 0xd800 && cp < 0xe000)) return { error: 'Escape is not a Unicode scalar value.' };
          out += String.fromCodePoint(cp); i += 2 + len; continue; }
        return { error: 'Unknown escape \\' + (n === undefined ? '' : n) + '. TOML allows \\b \\t \\n \\f \\r \\" \\\\ \\uXXXX \\UXXXXXXXX.' };
      }
      if (c === '"') return { error: 'Unescaped quote inside the string.' };
      var code = c.codePointAt(0); if ((code < 32 && c !== '\t') || code === 127) return { error: 'Control characters must be escaped.' };
      out += c; i++;
    }
    return { value: out };
  }
  function classify(input) {
    var s = String(input).replace(/^[ \t]+|[ \t]+$/g, '');
    if (s[0] === '"' || s[0] === "'") {
      if (/^("""|''')/.test(s)) return fail('Multi-line strings are outside what this tool covers.');
      var q = s[0]; if (s.length < 2 || s[s.length - 1] !== q) return fail('String is not closed.');
      var body = s.slice(1, -1);
      if (q === "'") { if (body.indexOf("'") >= 0) return fail('A literal string cannot contain a single quote.'); if (/[\u0000-\u0008\u000a-\u001f\u007f]/.test(body)) return fail('Control characters are not allowed in literal strings.'); return { ok: true, type: 'string', kind: 'literal string', value: body }; }
      var u = unescapeBasic(body); if (u.error) return fail(u.error); return { ok: true, type: 'string', kind: 'basic string', value: u.value };
    }
    if (s[0] === '[' || s[0] === '{') return fail('Arrays and inline tables are outside what this tool covers.');
    if (s === 'true' || s === 'false') return { ok: true, type: 'boolean', value: s };
    if (RE_SPECIAL.test(s)) { var m0 = /^([+-]?)(inf|nan)$/.exec(s); return { ok: true, type: 'float', value: m0[2] === 'nan' ? 'nan' : (m0[1] === '-' ? '-inf' : 'inf') }; }
    var mi = null;
    if (RE_INT.test(s)) mi = BigInt(s.replace(/_/g, ''));
    else if (RE_HEX.test(s)) mi = BigInt(s.replace(/_/g, '')); else if (RE_OCT.test(s)) mi = BigInt(s.replace(/_/g, '')); else if (RE_BIN.test(s)) mi = BigInt(s.replace(/_/g, ''));
    if (mi !== null) { if (mi < MIN || mi > MAX) return fail('Integer does not fit in 64 bits (TOML requires an error rather than rounding).'); return { ok: true, type: 'integer', kind: /^[+-]?[0-9]/.test(s) && !/^0[xob]/.test(s) ? 'decimal' : { x: 'hexadecimal', o: 'octal', b: 'binary' }[s[1]], value: mi.toString() }; }
    if (RE_FLOAT.test(s)) { var f = parseFloat(s.replace(/_/g, '')); if (!isFinite(f)) return fail('Float is outside the binary64 range.'); return { ok: true, type: 'float', value: String(Object.is(f, -0) ? '-0' : f) }; }
    // date and time forms
    var dm = /^([0-9]{4}-[0-9]{2}-[0-9]{2})(?:[Tt ]([0-9:.]+)(Z|z|[+-][0-9]{2}:[0-9]{2})?)?$/.exec(s);
    if (dm && !(s.indexOf(' ') > 0 && !dm[2])) {
      var d = parseDate(dm[1]); if (d.error) return fail(d.error);
      if (!dm[2]) return { ok: true, type: 'local date', value: d.text };
      var t = parseTime(dm[2]); if (!t) return fail('Not a valid time.'); if (t.error) return fail(t.error);
      if (!dm[3]) return { ok: true, type: 'local date-time', value: d.text + 'T' + t.text, note: t.truncated ? 'Fraction truncated to microseconds.' : '' };
      var off = /^[zZ]$/.test(dm[3]) ? '+00:00' : dm[3]; var oh = +off.slice(1, 3), om = +off.slice(4, 6);
      if (oh > 23 || om > 59) return fail('UTC offset out of range.');
      return { ok: true, type: 'offset date-time', value: d.text + 'T' + t.text + off, note: t.truncated ? 'Fraction truncated to microseconds.' : '' };
    }
    var tm = parseTime(s); if (tm) { if (tm.error) return fail(tm.error); return { ok: true, type: 'local time', value: tm.text }; }
    return fail(diagnose(s));
  }
  function parseLine(line) {
    var m = /^\s*([A-Za-z0-9_-]+|"[^"]*"|'[^']*')\s*=\s*(.*)$/.exec(line); if (!m) return { ok: false, error: 'Expected key = value.', key: null };
    var v = m[2], inStr = null, cut = -1;
    for (var i = 0; i < v.length; i++) { var c = v[i]; if (inStr) { if (c === '\\' && inStr === '"') i++; else if (c === inStr) inStr = null; } else if (c === '"' || c === "'") inStr = c; else if (c === '#') { cut = i; break; } }
    if (cut >= 0) v = v.slice(0, cut);
    var r = classify(v); r.key = m[1]; return r;
  }
  var api = { classify: classify, parseLine: parseLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TomlWhy = api;
})(typeof window !== 'undefined' ? window : this);
