document.addEventListener("DOMContentLoaded", ()=> {
  const out = document.getElementById('out');
  const inp = document.getElementById('in');
  document.getElementById("compile").addEventListener('click', ()=> {
    out.value = Fuckscript(inp.value);
  });
  document.getElementById('cp').addEventListener("click", () => {
    navigator.clipboard.writeText(out.value).then(() => {
      alert('copied!');
    }).catch(() => {
      alert('failed');
    });
  })
  inp.value = localStorage.sav ?? '';
  inp.addEventListener('input', () => {
    localStorage.sav = inp.value;
  });
});