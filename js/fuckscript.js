function Fuckscript(str) {
  let out = '';
  let ptr = 0;
  let work = 0;
  const vars = {};
  const bf = (s) => {
    out += s;
  };
  const point = (a) => {
    if (a == ptr) return;
    bf(((a > ptr) ? '>': '<').repeat(Math.abs(a - ptr)));
    ptr = a;
  };
  const move = (f, t) => {
    point(f); bf('[-'); point(t);
    bf('+'); point(f); bf(']');
  };
  const copy = (f, t, tmp = work) => {
    //move from src to target and temp
    point(f); bf('[-'); point(t);
    bf('+'); point(tmp); bf('+');
    point(f); bf(']');
    //move from temp to src
    move(tmp, f);
  };
  const clear = (a, large) => {
    point(a); bf(large ? '[+]': '[-]');
  };
  const setAt = (at, val, opt) => {
    const b = (val > 128);
    const c = (b ? '-': '+').repeat(b ? (128-(val-128)): val);
    clear(at, opt); point(at); bf(c);
  };
  const notify = (mv) => {
    ptr += mv;
  };
  var types = {
    nil: {
      name: 'nil',
      generic: 'nil',
      size: ()=>0
    },
    u8: {
      name: 'u8',
      generic: 'num',
      size: ()=>1,
      set: (t, val) => {
        setAt(t.ptr, parseInt(val));
      }
    },
    u16: {
      name: 'u16',
      generic: 'num',
      size: ()=>2,
      set: (t, val) => {
        const v = parseInt(val);
        setAt(t.ptr, (v & 0xff00) >> 8);
        setAt(t.ptr+1, v & 0xff);
      }
    }
  };
  var opHandlers = {
    add_u8_u8_u8: (a, b, t) => {
      copy(a.ptr, work, work+1);
      copy(b.ptr, work, work+1);
      clear(t.ptr);
      move(work, t.ptr);
    },
    sub_u8_u8_u8: (a, b, t) => {
      copy(a.ptr, work, work+1);
      copy(b.ptr, work+1, work+2);
      point(work+1);
      bf('[-<->]');
      clear(t.ptr);
      move(work, t.ptr);
    },
    mul_u8_u8_u8: (a, b, t) => {
      copy(a.ptr, work, work+1);
      copy(b.ptr, work+1, work+2);
      point(work);
      bf('[->[->+>+<<]>>[-<<+>>]<<<]>[-]>');
      notify(2);
      clear(t.ptr);
      move(work+2, t.ptr);
    },
    add_u16_u8_u16: (a, b, t) => {
      copy(a.ptr, work, work+1);
      copy(a.ptr+1, work+1, work+2);
      copy(b.ptr, work+2, work+3);
      point(work+2);
      bf('[-<+<+>[->>+>+<<<]>>>[-<<<+>>>]<[[-]>+<]>[<<<<->>>>-]<<]');
      clear(t.ptr);
      clear(t.ptr+1);
      move(work, t.ptr);
      move(work+1, t.ptr+1);
    },
    cast_u8_u8: (a, t) => {
      clear(t.ptr);
      copy(a.ptr, t.ptr);
    },
    cast_u16_u16: (a, t) => {
      clear(t.ptr+1);
      clear(t.ptr);
      copy(a.ptr + 1, t.ptr + 1);
      copy(a.ptr, t.ptr);
    },
    cast_u8_u16: (a, t) => {
      clear(t.ptr+1);
      clear(t.ptr);
      copy(a.ptr, t.ptr + 1);
    },
    cast_u16_u8: (a, t) => {
      clear(t.ptr);
      copy(a.ptr+1, t.ptr);
    }
  };
  /*const opTypes = {
    ['+']: 'add',
    ['-']: 'sub',
    ['*']: 'mul'
    }*/
  const define = (name, type, ...params) => {
    type = type || 'u8';
    if (vars[name]) {
      throw new Error('Redefinition of variable '+name+' on line '+i);
    }
    const nv = {
      name: name,
      ptr: work,
      type: type,
      size: types[type].size(...params),
      params: params,
    };
    if (types[type].onPreDefine) {
      types[type].onPreDefine(nv);
    }
    vars[name] = nv;
    const occupiedCells = new Array(work).fill(false);
    for (const [i, v] of Object.entries(vars)) {
      for (let j = v.ptr; j < (v.ptr+v.size); j++) {
        occupiedCells[j] = v;
      }
    }
    let blockStart;
    let freeSize = 0;
    const shouldAllocate = occupiedCells.every((v, i) => {
      if (v) {
        if (freeSize >= nv.size) {
          return false;
        }
        freeSize = 0;
      } else {
        if (freeSize == 0) blockStart = i;
        freeSize++;
      }
      return true;
    });
    if (shouldAllocate) {
      console.log('allocated '+name);
      work += nv.size;
    } else {
      console.log('reuse block '+blockStart+' for var '+name)
      nv.ptr = blockStart;
    }
    if (types[type].onDefine) {
      types[type].onDefine(nv);
    }
    return nv;
  };
  const undefine = (name) => {
    if (!vars[name]) {
      throw new Error('Trying to undefine a nonexistent variable '+name);
    }
    let maxmem;
    for (const [i, v] of Object.entries(vars)) {
      if (v.ptr > (maxmem?.ptr ?? -1)) maxmem = v;
    }
    if (maxmem === vars[name]) {
      work -= maxmem.size;
      console.log('shrinking');
    }
    delete vars[name];
  }
  const stack = {}
  //
  let lines = str.split('\n').map((v) => {
    return v.trim();
  }).filter((v) => !!v);
  lines.forEach((v, line) => {
    let cmd = v.split(' ');
    let args = cmd.slice(1).join(' ').split(' ');
    cmd = cmd[0];
    const fcmd = cmd.slice(1);
    switch (cmd[0]) {
      case '-':
        undefine(fcmd);
        break;
      case '+':
        define(fcmd, args[0], ...args.slice(1))
        break;
      default:
        switch (cmd.toLowerCase().trim()) {
          case 'set':
            const setTarg = vars[args[0]];
            switch (args[1].toLowerCase().trim()) {
              case 'val':
                let cval = args[2].trim();
                if (cval[2] == '"' && cval[0] == '"' && (cval.length === 3)) {
                  cval = cval.charCodeAt(1);
                } else {
                  cval = parseInt(cval);
                }
                types[setTarg.type].set(setTarg, cval);
                break;
              case 'op':
                if (1) {
                  const op = args[2];
                  const a = vars[args[3]];
                  const b = vars[args[4]];
                  if (!a) throw new Error('invalid operand a');
                  if (!b) throw new Error('invalid operand b');
                  const opName = op+'_'+a.type+'_'+b.type+'_'+setTarg.type;
                  if (!opHandlers[opName]) throw new Error('cant '+opName);
                  opHandlers[opName](a, b, setTarg);
                }
                break;
              case 'var':
                const from = vars[args[2]];
                const castName = 'cast_'+from.type+'_'+setTarg.type;
                opHandlers[castName](from, setTarg);
                break;
            }
            break;
          case 'print':
            const prnt = vars[args[0]];
            const ptype = types[prnt.type];
            if (ptype.print && !(args[1] === 'raw')) {
              ptype.print(prnt);
            } else {
              if (!ptype.print) {
                console.log(ptype.name+' doesn\'t implement print');
              }
              point(prnt.ptr);
              bf('.');
            }
            break;
          case 'bf':
            bf(args.join(''));
            break;
          default:
            if (cmd.startsWith('//')) {
              break;
            }
            throw new Error('Uknown cmd');
            break;
        }
        break;
    }
  });
  //check
  let pcnt = 0;
  for (const char of out) {
    if (char == '[') pcnt++;
    if (char == ']') pcnt--;
  }
  if (pcnt) throw new Error('Invalid brainfuck code');
  //optimize
  const nops = [
    /\>\</g,
    /\<\>/g,
    /\+\-/g,
    /\-\+/g,
    /\[\-\]\[\-\]/g,
    /\[\]/g
  ]
  let cont = true;
  while (cont) {
    cont = false;
    nops.forEach(v => {
      out = out.replace(v, () => {
        cont = true;
        return '';
      })
    });
  }
  //remove trailing moves
  while (true) {
    if (out.endsWith('<') || out.endsWith('>')) {
      out = out.slice(0, -1);
    } else {
      break;
    }
  }
  console.log('out '+out);
  return out;
}