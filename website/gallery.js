const tabs = [...document.querySelectorAll('[data-shot]')];
const image = document.querySelector('#preview-image');
const caption = document.querySelector('#preview-caption');
const panel = document.querySelector('#screenshot-panel');
const openImage = document.querySelector('.screenshot-open');
const dialog = document.querySelector('#image-dialog');
const dialogImage = document.querySelector('#dialog-image');
function selectScreenshot(tab) {
  tabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  image.src = 'assets/' + tab.dataset.file;
  image.alt = tab.textContent.trim();
  openImage.href = image.src;
  caption.textContent = tab.dataset.caption || tab.textContent.trim();
  panel.setAttribute('aria-labelledby', tab.id);
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectScreenshot(tab));
  tab.addEventListener('keydown', (event) => {
    let target;
    if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
    if (event.key === 'ArrowLeft')
      target = tabs[(index - 1 + tabs.length) % tabs.length];
    if (event.key === 'Home') target = tabs[0];
    if (event.key === 'End') target = tabs[tabs.length - 1];
    if (!target) return;
    event.preventDefault();
    selectScreenshot(target);
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'instant',
    });
  });
});
openImage.addEventListener('click', (event) => {
  if (typeof dialog.showModal !== 'function') return;
  event.preventDefault();
  dialogImage.src = image.src;
  dialogImage.alt = image.alt;
  document.querySelector('#dialog-caption').textContent = caption.textContent;
  dialog.showModal();
  document.body.style.overflow = 'hidden';
});
document
  .querySelector('.dialog-close')
  .addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.style.overflow = '';
  dialogImage.removeAttribute('src');
});
document.addEventListener('site-language-change', () =>
  selectScreenshot(
    tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0],
  ),
);
selectScreenshot(tabs[0]);
