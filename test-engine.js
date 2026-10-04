const T=require('./engine.js'),cp=require('child_process');
let seed=12345;const rnd=n=>{seed=(seed*1103515245+12345)&0x7fffffff;return (seed>>8)%n};
const pick=a=>a[rnd(a.length)];
const fixed=['+99','42','0','-17','+0','-0','1_000','5_349_221','1_2_3_4_5','0xDEADBEEF','0xdead_beef','0o01234567','0o755','0b11010110','+1.0','3.1415','-0.01','5e+22','1e06','-2E-2','6.626e-34','224_617.445_991_228','.7','7.','3.e+20','-0.0','+0.0','inf','+inf','-inf','nan','+nan','-nan','Inf','NaN','true','false','True','FALSE','yes','no','null','1979-05-27T07:32:00Z','1979-05-27T00:32:00-07:00','1979-05-27T00:32:00.999999-07:00','1979-05-27 07:32:00Z','1979-05-27T07:32:00','1979-05-27T00:32:00.999999','1979-05-27','07:32:00','00:32:00.999999','07:32','2021-02-29','2020-02-29','2021-13-01','1979-05-27T25:00:00Z','"hi"',"'hi'",'"a\\tb"','"a\\qb"','"\\u00e9"','"\\u12"',"'it''s'",'"unterminated','9223372036854775807','9223372036854775808','-9223372036854775808','-9223372036854775809','0xFFFFFFFFFFFFFFFF','+0x10','0x_10','1_','_1','0755','00','1e','1e+','1.5e3','1E5','-inf1','1979-05-27 ','1979-5-27','12:00:00Z','"x" # c'];
const gen=()=>{const k=rnd(8);const d=n=>String(rnd(10**n)).padStart(n,'0');
 if(k==0)return pick(['','+','-'])+pick(['0','1','12','007','1_0','1__0','_1','9_9'])
 if(k==1)return pick(['','-','+'])+d(1+rnd(3))+pick(['.',''])+d(rnd(3))+pick(['','e','E5','e-3','e+','e_1'])
 if(k==2)return pick(['0x','0o','0b','-0x'])+pick(['','1','7','F','f_f','8','2','_1','1_'])
 if(k==3)return d(4)+'-'+d(2)+'-'+d(2)+pick(['','T','t',' '])+(rnd(2)?d(2)+':'+d(2)+':'+d(2)+pick(['','.5','.123456789'])+pick(['','Z','z','+02:00','-23:59','+24:00']):'')
 if(k==4)return d(2)+':'+d(2)+pick([':'+d(2),'',':'+d(2)+'.'+d(3)])
 if(k==5)return pick(['true','false','True','tRue','inf','-inf','+nan','Nan','nan','infinity','on'])
 if(k==6)return '"'+pick(['a','\\n','\\x','\\u0041','\\U0001F600','\\uD800','\\','\\"','"'])+'"'
 return pick(['1','0','5','-3'])+pick(['e1','.0','_0','0'])};
const cases=fixed.slice();for(let i=0;i<4000;i++)cases.push(gen());
const o=JSON.parse(cp.execFileSync('python3',['oracle.py'],{input:JSON.stringify(cases),maxBuffer:1e8}));
let bad=0,seen={};
const same=(a,b)=>{if(a==b)return true;const x=Number(a),y=Number(b);return a!==''&&b!==''&&!isNaN(x)&&x==y};
const DEV=(s,p)=>(p[0]==='integer'&&(BigInt(p[1])>2n**63n-1n||BigInt(p[1])<-(2n**63n)))||(p[0]==='local time'&&/^[0-9]{2}:[0-9]{2}$/.test(s))||(/ #/.test(s));
let dev=0;
cases.forEach((s,i)=>{const r=T.classify(s),p=o[i];if(DEV(s,p)){dev++;return}
 const rt=r.ok?r.type:'ERR';let pt=p[0]==='string'?'string':p[0];
 let ok=rt===pt&&(rt==='ERR'||pt==='string'&&r.value===p[1]||pt!=='string'&&(same(r.value,p[1])||p[1].replace('T',' ')===r.value||p[1]===r.value.replace('+00:00','+00:00')));
 if(!ok&&r.ok&&p[0]==='offset date-time'&&r.type===rt&&r.value===p[1].replace('Z','+00:00'))ok=true;
 if(!ok){bad++;if(bad<=25)console.log('MISMATCH',JSON.stringify(s),JSON.stringify(r),JSON.stringify(p))}
 seen[pt]=(seen[pt]||0)+1});
console.log('checks',cases.length,'mismatches',bad,'documented deviations skipped',dev,JSON.stringify(seen));process.exit(bad?1:0);
