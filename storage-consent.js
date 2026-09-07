(function () {
  "use strict";

  const CONSENT_KEY = "j5x-local-storage-consent-v1";
  const root = document.documentElement;
  const storage = (() => {
    try {
      const probe = "__j5x_storage_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      return localStorage;
    } catch (error) {
      return null;
    }
  })();

  function readConsent() {
    if (!storage) return "unavailable";
    try { return storage.getItem(CONSENT_KEY) || null; } catch (error) { return null; }
  }

  function parse(value, fallback) {
    try { return value == null ? fallback : JSON.parse(value); } catch (error) { return fallback; }
  }

  function get(key, fallback) {
    if (!storage || readConsent() !== "granted") return fallback;
    try { return parse(storage.getItem(key), fallback); } catch (error) { return fallback; }
  }

  function set(key, value) {
    if (!storage || readConsent() !== "granted") return false;
    try { storage.setItem(key, JSON.stringify(value)); return true; } catch (error) { return false; }
  }

  function remove(key) {
    if (!storage) return false;
    try { storage.removeItem(key); return true; } catch (error) { return false; }
  }

  function dispatch(decision) {
    window.dispatchEvent(new CustomEvent("j5x-storage-consent", { detail: { consent: decision, granted: decision === "granted" } }));
  }

  function setConsent(decision) {
    if (!storage) return;
    try { storage.setItem(CONSENT_KEY, decision); } catch (error) { return; }
    document.getElementById("j5xStorageConsent")?.remove();
    dispatch(decision);
  }

  function copy() {
    const english = root.lang.toLowerCase().startsWith("en");
    return english ? {
      title: "Save your tool preferences?",
      body: "With your agreement, this site stores tool settings such as language, currencies, and output options in this browser only. Nothing is uploaded and no tracking cookies are used.",
      accept: "Agree & save",
      decline: "Not now",
      label: "Local storage preference"
    } : {
      title: "要儲存你的工具偏好嗎？",
      body: "同意後，本網站會把語言、幣種與輸出選項等工具設定儲存在此瀏覽器的本機儲存（Local Storage）。資料只留在本機、不會上傳，也不使用追蹤 Cookie。",
      accept: "同意並儲存",
      decline: "暫不儲存",
      label: "本機儲存偏好設定"
    };
  }

  function renderConsent() {
    if (!storage || readConsent() || document.getElementById("j5xStorageConsent")) return;
    const text = copy();
    const dialog = document.createElement("aside");
    dialog.id = "j5xStorageConsent";
    dialog.className = "j5x-storage-consent";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-labelledby", "j5xStorageConsentTitle");
    dialog.setAttribute("aria-describedby", "j5xStorageConsentBody");
    dialog.innerHTML = `<div class="j5x-storage-consent__copy"><strong id="j5xStorageConsentTitle">${text.title}</strong><p id="j5xStorageConsentBody">${text.body}</p></div><div class="j5x-storage-consent__actions"><button type="button" class="j5x-storage-consent__decline">${text.decline}</button><button type="button" class="j5x-storage-consent__accept">${text.accept}</button></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector(".j5x-storage-consent__accept").addEventListener("click", () => setConsent("granted"));
    dialog.querySelector(".j5x-storage-consent__decline").addEventListener("click", () => setConsent("denied"));
  }

  const style = document.createElement("style");
  style.textContent = `
    .j5x-storage-consent{position:fixed;left:50%;bottom:1.25rem;z-index:9999;width:min(720px,calc(100% - 2rem));display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.15rem;border:1px solid var(--color-accent,#ff9ef7);border-radius:14px;background:color-mix(in srgb,var(--color-paper-raised,#191720) 94%,transparent);color:var(--color-ink,#f5f3f6);box-shadow:0 18px 48px rgba(0,0,0,.48);backdrop-filter:blur(16px);font:500 .875rem/1.45 "Noto Sans TC","Segoe UI",sans-serif;transform:translateX(-50%);animation:j5xConsentIn .24s cubic-bezier(.16,1,.3,1)}
    .j5x-storage-consent__copy{min-width:0}.j5x-storage-consent__copy strong{display:block;color:var(--color-accent,#ff9ef7);font-size:.95rem}.j5x-storage-consent__copy p{margin:.25rem 0 0;color:var(--color-muted,#aaa4b1);font-size:.78rem}.j5x-storage-consent__actions{display:flex;flex:0 0 auto;align-items:center;gap:.5rem}.j5x-storage-consent__actions button{min-height:38px;padding:.5rem .75rem;border:1px solid var(--color-rule,#37313f);border-radius:8px;background:transparent;color:var(--color-muted,#aaa4b1);font:700 .78rem/1 "Noto Sans TC","Segoe UI",sans-serif;cursor:pointer}.j5x-storage-consent__actions button:hover{border-color:var(--color-accent,#ff9ef7);color:var(--color-accent,#ff9ef7)}.j5x-storage-consent__actions .j5x-storage-consent__accept{border-color:var(--color-accent,#ff9ef7);background:var(--color-accent,#ff9ef7);color:var(--color-paper,#191720)}.j5x-storage-consent__actions .j5x-storage-consent__accept:hover{filter:brightness(1.08);color:var(--color-paper,#191720)}@keyframes j5xConsentIn{from{opacity:0;transform:translate(-50%,1rem)}to{opacity:1;transform:translate(-50%,0)}}@media(max-width:600px){.j5x-storage-consent{bottom:.75rem;flex-direction:column;align-items:stretch;gap:.75rem;width:calc(100% - 1.5rem);padding:.9rem}.j5x-storage-consent__actions{justify-content:flex-end}.j5x-storage-consent__actions button{flex:1}}@media(prefers-reduced-motion:reduce){.j5x-storage-consent{animation:none}}
  `;
  document.head.appendChild(style);

  window.J5XStorage = Object.freeze({
    get,
    set,
    remove,
    consent: readConsent,
    hasConsent: () => readConsent() === "granted"
  });

  const ready = () => renderConsent();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();
  window.addEventListener("j5x-language-change", () => {
    const dialog = document.getElementById("j5xStorageConsent");
    if (!dialog) return;
    dialog.remove();
    renderConsent();
  });
})();
