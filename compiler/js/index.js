document.addEventListener("DOMContentLoaded", ()=> {
  const out = document.getElementById('out');
  const inp = document.getElementById('in');
  document.getElementById("compile").addEventListener('click', ()=> {
    out.value = Fuckscript(inp.value);
  });
  document.getElementById('cp').addEventListener("click", () => {
    try {
      navigator.clipboard.writeText(out.value).then(() => {
        alert('copied!');
      });
    } catch(e) {
      out.select();
      document.execCommand("copy");
      alert('copied');
    }
  });
  inp.value = localStorage.sav ?? `
  +a u8 //declare a var of type u8
  +b    //type defaults to u8
  set a val ","
  set b val 10
  for b
  \x09print b int
  \x09if b // if b>0
  \x09\x09print a raw
  \x09end
  end
  `;
  inp.addEventListener('input',
    () => {
      localStorage.sav = inp.value;
    });
});