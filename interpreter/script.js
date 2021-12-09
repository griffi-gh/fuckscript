addEventListener('load', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has('c')) {
    document.getElementById('program').value = params.get('c');
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
      document.getElementById('cells').appendChild(cell);
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

  document.getElementById('cells').addEventListener('overscroll', () => {
    expandCellsTo(cells.length + 50);
  });

  expandCellsTo(50);
  movePtr(0);

  const out = document.getElementById('stdout');

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
    document.getElementById('run').classList.remove('running');
  }
  document.getElementById('run').addEventListener('click', () => {
    if (int) {
      onStop('user');
    } else {
      console.log('start');
      document.getElementById('run').classList.add('running');
      loadProg(document.getElementById('program').value);
      const fn = () => {
        if (step()) {
          int = setTimeout(fn, 0);
        } else {
          onStop('file end');
        }
      };
      fn();
    }
  });
});