const randomStr = () => Math.random().toString(36).substr(2, 5);

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
      },
      isTrue: (t, res) => {
        clear(res.ptr);
        copy(t.ptr, res.ptr);
      },
      print: (t, as) => {
        //from stackoverflow solution
        const printAsInt = (`
          >>++++++++++<<[->+>-[>+>>]>[+[-<+>]>+>>]<<<<<<]>>[-]>>>++++++++++<[->-[>+>>]>[+[-
          <+>]>+>>]<<<<<]>[-]>>[>++++++[-<++++++++>]<.<<+>+>[-]]<[<[->-<]++++++[->++++++++
          <]>.[-]]<<++++++[-<++++++++>]<.[-]<<[-<+>]<
          `).replace(/\n/g, '');
        copy(t.ptr, work, work+1);
        point(work);
        switch (as) {
          default: //if none or 'ascii'
            bf('.');
            break;
          case 'int':
            bf(printAsInt);
            break;
        }
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
      /*if (!noCleanup) {
        point(work);
        for (let i = 0; i < maxmem.size; i++) {
          bf('[-]>');
        }
        notify(maxmem.size);
      }*/
      console.log('shrinking');
    }
    delete vars[name];
  }
  const stack = [];
  initStackVal = function(v) {
    v.owned = [];
    v.clearOwned = () => {
      v.owned.forEach(undefine);
      v.owned = [];
    }
  }
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
        /*if (args[0] != 'keep') {
          const cv = vars[fcmd];
          for (let i = 0; i < cv.size; i++) {
            clear(cv.ptr + i);
          }
        }*/
        undefine(fcmd);
        break;
      case '+':
        if (stack.length) {
          stack.slice(-1)[0].owned.push(fcmd);
        }
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
          case 'if':
            const targ = vars[args[0]];
            const nnn = {
              tmpvar: define('if-'+randomStr(), 'u8'),
              type: 'if'
            };
            initStackVal(nnn);
            types[targ.type].isTrue(targ, nnn.tmpvar);
            stack.push(nnn);
            point(nnn.tmpvar.ptr);
            bf('[');
            break;
          case 'else':
            const stkt = stack.slice(-1)[0];
            if (stkt.type === 'if') {
              point(work); bf('+');
              point(stkt.tmpvar.ptr);
              bf('[-]]+');
              point(work);
              bf('[-');
              point(stkt.tmpvar.ptr);
              bf('-');
              point(work);
              bf(']');
              point(stkt.tmpvar.ptr);
              bf('[');
              stkt.hasElse = true;
              stkt.clearOwned();
            } else {
              throw new Error('not an if');
            }
            break;
          case 'end':
            const popval = stack.pop();
            switch (popval?.type) {
              case 'if':
                const tv = popval.tmpvar;
                point(tv.ptr);
                bf('[-]]');
                undefine(tv.name);
                break;
              default:
                throw new Error('Invalid end statement');
                break;
            }
            popval.clearOwned();
            break;
          case 'print':
            const prnt = vars[args[0]];
            const ptype = types[prnt.type];
            if (ptype.print && !(args[1] === 'raw')) {
              ptype.print(prnt, args[1]);
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
    //bf('\n');
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