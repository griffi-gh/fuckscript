addEventListener('load', () => {
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

  $id('ad-close').style.fontSize = '0px';
  setTimeout(() => $id('ad-close').style.fontSize = '', 2500);

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
    out.value = '';
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
          out.value += String.fromCharCode(cellGet());
          out.scrollTo(99999999, 9999999);
          break;
        default:
          break;
      }
    }
    return (char && (pc < prog.length));
  }

  let int;
  function onStop(r) {
    console.log('stop; reason: '+r);
    clearInterval(int);
    int = null;
    $id('run').classList.remove('running');
  }
  $id('run').addEventListener('click', () => {
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
          //TODO: Fast
          //recompile bf to js
        }
      }
    }
  });
});