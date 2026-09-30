// Bug/feedback form on report.html → POST /api/report. A separate file, not an inline <script>,
// so the site-wide Content-Security-Policy in _headers can stay at script-src 'self'.
const form = document.getElementById('report-form');
const statusEl = document.getElementById('form-status');
const submitBtn = document.getElementById('submit-btn');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  // Honeypot: if filled, silently drop without hitting the API.
  if (form.company.value) {
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';
  statusEl.className = 'form-status';

  const payload = {
    type: form.type.value,
    platform: form.platform.value,
    email: form.email.value.trim(),
    version: form.version.value.trim(),
    description: form.description.value.trim(),
  };

  try {
    const response = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Request failed');
    }

    form.reset();
    statusEl.textContent = 'Thanks — your report was sent. We read every one.';
    statusEl.className = 'form-status is-visible is-success';
  } catch (err) {
    statusEl.textContent = 'Something went wrong. Please email gandribidav@gmail.com instead.';
    statusEl.className = 'form-status is-visible is-error';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send report';
  }
});
