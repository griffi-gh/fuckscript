const fullUrlWithoutParams =
window.location.protocol +
"//" +
window.location.host +
window.location.pathname;
document.addEventListener('DOMContentLoaded', () => {
  const $id = id => document.getElementById(id);
  window._$id_ = $id;
  const params = new URLSearchParams(window.location.search);
  let autosave = true;
  if (params.has('source')) {
    const v = params.get('source');
    if (v == 'fuckscript-run' || v == 'fuckscript-ad') {
      setTimeout(() => $id('ad-close').click(), 3000);
    }
  }

  try {
    $id('ad-close').style.fontSize = '0px';
    setTimeout(() => $id('ad-close').style.fontSize = '', 2500);
  }catch(e) {}

  if (params.has('c')) {
    if (!params.has('save')) autosave = false;
    $id('program').value = params.get('c');
  } else {
    $id('program').value = localStorage.autosave ?? '';
  }
  if (autosave) {
    $id('program').addEventListener('input', () => {
      localStorage.autosave = $id('program').value;
    });
    autosave = true;
    document.body.classList.add('autosave-enabled');
  }
  $id('reload-saved').addEventListener('click', evt => {
    evt.preventDefault();
    evt.stopPropagation();
    localStorage.autosave = $id('program').value;
    document.location.href = '?'
  });
  $id('ad-close').addEventListener('click', evt => {
    evt.preventDefault();
    evt.stopPropagation();
    localStorage.adClosed = '1';
    $id('fuckscript-ad').remove()
  });
  if ((localStorage.adClosed | 0) === 1) {
    $id('fuckscript-ad').remove();
  }

  $id('cp').addEventListener('click', () => {
    const out = $id('stdout');
    try {
      navigator.clipboard.writeText(out.value.slice(2).replace(/\<br\>/g, '\n')).then(() => {
        alert('copied!');
      });
    } catch(e) {
      out.select();
      document.execCommand("copy");
      alert('copied');
    }
  });
  $id('uploaded').addEventListener('change', () => {
    const file = $id('uploaded').files[0];
    const reader = new FileReader();
    reader.onload = () => {
      $id('program').value = reader.result;
      // todo if(reader.result.length >
    };
    reader.readAsText(file);
  });
  $id('share').addEventListener('click', () => {
    navigator.share({
      url: fullUrlWithoutParams + '?source=share&c=' + encodeURIComponent($id('program').value)
    }).then(
      _ => alert('shared')
    ).catch(alert)
  });

  const cells = [];
  const mem = new Uint8Array(30000);
  let ptr = 0;
  let pc = 0;
  //
  function expandCellsTo(x) {
    if (x <= cells.length) return;
    x = Math.min(x, mem.length);
    const l = cells.length;
    for (let i = 0; i < (x - l); i++) {
      const cell = document.createElement('div');
      cell.innerHTML = '0';
      cell.classList.add('cell');
      $id('cells').appendChild(cell);
      cells.push(cell);
    }
  }
  //
  function movePtr(i) {
    expandCellsTo(i + 5);
    cells[ptr].classList.remove('active');
    cells[i].classList.add('active');
    ptr = i;
  }
  function incPtr() {
    movePtr(ptr + 1);
  }
  function decPtr() {
    movePtr(ptr - 1);
  }
  function cellGet() {
    return mem[ptr];
  }
  function cellSet(v) {
    mem[ptr] = v;
    cells[ptr].innerHTML = (v & 0xFF).toString(10);
    //todo change base
  }
  function incCell() {
    cellSet(cellGet() + 1);
  }
  function decCell() {
    cellSet(cellGet() - 1);
  }

  $id('cells').addEventListener('overscroll', () => {
    expandCellsTo(cells.length + 50);
  });

  expandCellsTo(50);
  movePtr(0);

  const out = $id('stdout');

  let prog = '';
  let bracemap = [];

  function resetState() {
    mem.fill(0);
    cells.forEach(v => {
      v.innerHTML = 0;
    });
    movePtr(0);
    pc = 0;
    out.value = '> ';
  }

  resetState();

  function loadProg(p) {
    prog = p;
    //reset
    resetState();
    //build map
    bracemap = new Array(prog.length).fill(null);
    const stack = [];
    p.split('').forEach((v, i) => {
      if (v == '[') {
        stack.push(i);
      } else if (v == ']') {
        const back = stack.pop();
        bracemap[back] = i;
        bracemap[i] = back;
      }
    });
  }
  function step() {
    char = prog[pc++];
    if (char) {
      switch (char) {
        case '>':
          incPtr();
          break;
        case '<':
          decPtr();
          break;
        case '+':
          incCell();
          break;
        case '-':
          decCell();
          break;
        case '[':
          if (!cellGet()) pc = bracemap[pc-1]+1;
          break;
        case ']':
          if (cellGet()) pc = bracemap[pc-1]+1;
          break;
        case '.':
          out.value += String.fromCharCode(cellGet()).replace('\n', '<br>');
          out.scrollTo(99999999, 9999999);
          break;
        default:
          break;
      }
    }
    return (char && (pc < prog.length));
  }

  function compile() {
    const END = '\x00';
    const SUBLOOP = String.fromCharCode(0xFFFF);

    let js = 'let m=new Uint8Array(30000);let p=0;let o="";let c=String.fromCharCode;';
    let num;
    let ptrd;

    let mprog = prog + END;
    mprog = mprog.replace(/\[\-\]/g, SUBLOOP);
    mprog = mprog.replace(/\[\+\]/g, SUBLOOP);

    mprog.split('').forEach((v, i) => {
      const hnum = () => {
        if ((num != null) && !(v == '-' || v == '+' || v == 'SUBLOOP')) {
          if (num) js += 'm[p]'+((num < 0) ? '-': '+')+'='+Math.abs(num)+';';
          num = null;
        }
        if ((ptrd != null) && !(v == '<' || v == '>')) {
          if (ptrd) js += 'p'+((ptrd < 0) ? '-': '+')+'='+Math.abs(ptrd)+';';
          ptrd = null;
        }
      }
      switch (v) {
        case '-':
          hnum();
          num = (num ?? 0) - 1;
          break;
        case '+':
          hnum();
          num = (num ?? 0) + 1;
          break;
        case '<':
          hnum();
          ptrd = (ptrd ?? 0) - 1;
          break;
        case '>':
          hnum();
          ptrd = (ptrd ?? 0) + 1;
          break;
        case '[':
          hnum();
          js += 'while(m[p]){';
          break;
        case ']':
          hnum();
          js += '};';
          break;
        case '.':
          hnum();
          js += 'o+=c(m[p]);';
          break;
        case ',':
          hnum();
          //todo
          break;
        case END:
          hnum();
          break;
        case SUBLOOP:
          hnum();
          num = 0;
          js += 'm[p]=0;'
          break;
        default:
          break;
      }
    });
    js += 'return [o,m,p]';
    console.log(js)
    return new Function(js);
  }

  let int;
  function onStop(r) {
    console.log('stop; reason: '+r);
    clearInterval(int);
    int = null;
    $id('run').classList.remove('running');
  }
  $id('run').addEventListener('click',
    () => {
      if (int) {
        onStop('user');
      } else {
        console.log('start');
        $id('run').classList.add('running');
        loadProg($id('program').value);
        let SPED = () => parseFloat($id('speed').value);
        //console.log(SPED);
        if (SPED() >= 0) {
          const fn = () => {
            if (step()) {
              int = setTimeout(fn, SPED());
            } else {
              onStop('end');
            }
          };
          fn();
        } else {
          const s = SPED();
          if (s == -1) {
            //Immed.
            while (step()) {}
            onStop('end');
          } else if (s == -2) {
            resetState();
            const state = compile()();
            const cptr = state.pop();
            const cmem = state.pop();
            const cout = state.pop();
            //
            let updateTo = 0;
            Array.from(cmem).forEach((v, i) => {
              if (v) updateTo = i;
            });
            Array.from(cmem).every((v, i) => {
              if (i > updateTo) return false;
              movePtr(i)
              cellSet(v);
              return true;
            });
            movePtr(cptr);
            out.value += cout.replace(/\n/g,
              '<br>');
            onStop('end');
            //TODO: Fast
            //recompile bf to js
          }
        }
      }
    });
});