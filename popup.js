const DEFAULTS = {
  enabled: true,
  speakOnHover: true,
  speakOnDrag: true,
  speakOnCreate: true,
  rate: 0.9,
  pitch: 1.1,
  volume: 1.0,
  lang: 'en-US'
};

const checkboxes = ['enabled', 'speakOnHover', 'speakOnDrag', 'speakOnCreate'];
const ranges = ['rate', 'pitch', 'volume'];

function load() {
  chrome.storage.sync.get(DEFAULTS, (s) => {
    for (const k of checkboxes) document.getElementById(k).checked = !!s[k];
    for (const k of ranges) {
      const el = document.getElementById(k);
      el.value = s[k];
      document.getElementById(k + 'Out').textContent = Number(s[k]).toFixed(2);
    }
    document.getElementById('lang').value = s.lang;
  });
}

function save(key, value) {
  chrome.storage.sync.set({ [key]: value });
}

for (const k of checkboxes) {
  document.getElementById(k).addEventListener('change', (e) => {
    save(k, e.target.checked);
  });
}
for (const k of ranges) {
  const el = document.getElementById(k);
  el.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById(k + 'Out').textContent = v.toFixed(2);
    save(k, v);
  });
}
document.getElementById('lang').addEventListener('change', (e) => {
  save('lang', e.target.value);
});

document.getElementById('test').addEventListener('click', () => {
  chrome.storage.sync.get(DEFAULTS, (s) => {
    const u = new SpeechSynthesisUtterance('Fire and water make steam!');
    u.rate = s.rate;
    u.pitch = s.pitch;
    u.volume = s.volume;
    u.lang = s.lang;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
});

load();
