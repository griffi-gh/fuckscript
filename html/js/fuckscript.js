function Fuckscript(str) {
  let out = '';
  let ptr = 0;
  let work = 0;
  const vars = {};
  const bf = (s) => {
    out += s
  };
  const point = (a) => {
    if (a == ptr) return;
    bf(((a > ptr) ? '>': '<').repeat(Math.abs(a - ptr)));
    ptr = a;
  }
  const move = (f, t) => {
    point(f); bf('[-'); point(t);
    bf('+'); point(f); bf(']');
  }
  const copy = (f, t, tmp = work) => {
    //move from src to target and temp
    point(f); bf('[-'); point(t);
    bf('+'); point(tmp); bf('+');
    point(f); bf(']');
    //move from temp to src
    move(tmp, f);
  }
  const clear = (a, large) => {
    point(a); bf(large ? '[+]': '[-]');
  }
  const setAt = (at, val, opt) => {
    const b = (val > 128);
    const c = (b ? '-': '+').repeat(b ? (128-(val-128)): val);
    clear(at, opt); point(at); bf(c);
  }
  const notify = (mv) => {
    ptr += mv;
  }
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
  }
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
      copy(a.ptr, work, work+1)
      copy(b.ptr, work+1, work+2)
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
    }
  }
  /*const opTypes = {
    ['+']: 'add',
    ['-']: 'sub',
    ['*']: 'mul'
  }*/
  let lines = str.split('\n').map((v) => {
    return v.trim();
  }).filter((v) => !!v);
  lines.forEach((v, line) => {
    let cmd = v.split(' ');
    let args = cmd.slice(1).join(' ').split(' ');
    cmd = cmd[0];
    switch (cmd[0]) {
      case '-':
        if (0)break;
      case '+':
        let name = cmd.slice(1);
        if (cmd[0] === '+') {
          if (vars[name]) {
            throw new Error('Redefinition of variable '+name+' on line '+i);
          }
          const type = args[0] || 'u8';
          const nv = {
            name: name,
            ptr: work,
            type: type,
            len: args[1],
            size: types[type].size(args[1])
          }
          vars[name] = nv;
          //const sortedVars = Object.entries(vars).sort((a,b) => a[1].ptr - b[1].ptr);
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
          //todo search for right gap if cannot reuse
        } else {
          /*let maxmem;
          for (const [i, v] of Object.entries(vars)) {
            //console.log(JSON.stringify(v, null, 1));
            if (v.ptr > (maxmem?.ptr ??0)) maxmem = v;
          }
          if (name === '*') name = maxmem.name;
          if (!vars[name]) {
            throw new Error('Trying to undefine a nonexistent variable '+name+' on line '+line);
          }
          if (maxmem?.name === name) {
            work -= types[maxmem.type].size(maxmem.size)
            console.log('shrinking');
          }*/
          //todo fix shriking
          delete vars[name];
        }
        break;
      default:
        switch (cmd.toLowerCase().trim()) {
          case 'set':
            const setTarg = vars[args[0]];
            switch (args[1].toLowerCase().trim()) {
              case 'const':
                types[setTarg.type].set(setTarg, args[2]);
                //setAt(setTarg.ptr, parseInt(args[2]));
                break;
              case 'op':
                const op = args[2];
                const a = vars[args[3]];
                const b = vars[args[4]];
                if (!a) throw new Error('invalid operand a');
                if (!b) throw new Error('invalid operand b');
                const opName = op+'_'+a.type+'_'+b.type+'_'+setTarg.type;
                if (!opHandlers[opName]) throw new Error('cant '+opName);
                opHandlers[opName](a, b, setTarg);
                break;
            }
            break;
          default:
            throw new Error('Uknown cmd');
            break;
        }
        break;
    }
  });
  let cont = true;
  const nops = [
    /\>\</g,
    /\<\>/g,
    /\+\-/g,
    /\-\+/g,
    /\[\-\]\[\-\]/g,
    /\[\]/g,
  ]
  while (cont) {
    cont = false;
    nops.forEach(v => {
      out = out.replace(v, () => {
        cont = true;
        return '';
      })
    });
  }
  console.log('out '+out);
  return out;
}