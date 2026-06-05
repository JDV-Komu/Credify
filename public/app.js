const inputField = document.getElementById('inputField');
const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');
const analyzeButton = document.getElementById('analyzeButton');
const resultCard = document.getElementById('resultCard');
const resultLabel = document.getElementById('resultLabel');
const confidenceText = document.getElementById('confidenceText');
const analysisSummary = document.getElementById('analysisSummary');
const userStatus = document.getElementById('userStatus');
const authToggle = document.getElementById('authToggle');
const logoutButton = document.getElementById('logoutButton');
const authCard = document.getElementById('authCard');
const historyCard = document.getElementById('historyCard');
const historyList = document.getElementById('historyList');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const loginButton = document.getElementById('loginButton');
const registerButton = document.getElementById('registerButton');

let currentUser = null;

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

function displayResult(analysis) {
  resultCard.classList.remove('hidden');
  resultLabel.textContent = analysis.label;
  confidenceText.textContent = `Confidence: ${Math.round(analysis.confidence * 100)}%`;
  analysisSummary.textContent = analysis.reasoning;
  resultLabel.style.color = analysis.label === 'Fake News' ? '#b91c1c' : analysis.label === 'Not Fake News' ? '#15803d' : '#52525b';
}

function renderUserState() {
  if (currentUser) {
    userStatus.textContent = currentUser.email;
    logoutButton.classList.remove('hidden');
    authToggle.textContent = currentUser ? 'Account' : 'Login / Register';
    authCard.classList.add('hidden');
    historyCard.classList.remove('hidden');
    loadHistory();
  } else {
    userStatus.textContent = 'Guest';
    logoutButton.classList.add('hidden');
    authCard.classList.add('hidden');
    historyCard.classList.add('hidden');
    historyList.innerHTML = '';
  }
}

async function loadCurrentUser() {
  try {
    const data = await fetchJson('/api/me');
    currentUser = data.user;
    renderUserState();
  } catch (err) {
    currentUser = null;
    renderUserState();
  }
}

async function loadHistory() {
  if (!currentUser) return;
  try {
    const data = await fetchJson('/api/history');
    historyList.innerHTML = data.history.map((item) => `
      <li>
        <div class="history-item-title">${item.result} — ${Math.round(item.confidence * 100)}%</div>
        <div>${item.content.length > 180 ? item.content.slice(0, 180) + '…' : item.content}</div>
        <div class="history-item-meta">${new Date(item.created_at).toLocaleString()}</div>
      </li>
    `).join('');
  } catch (err) {
    historyList.innerHTML = '<li><em>Unable to load history.</em></li>';
  }
}

analyzeButton.addEventListener('click', async () => {
  const input = inputField.value.trim();
  const file = fileInput.files[0];

  if (!input && !file) {
    alert('Enter a URL, image link, text, or choose a file first.');
    return;
  }

  try {
    let data;
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      data = await fetchJson('/api/analyze-file', {
        method: 'POST',
        body: formData
      });
    } else {
      data = await fetchJson('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      });
    }

    displayResult(data.analysis);
    if (data.saved) {
      loadHistory();
    }
  } catch (err) {
    alert(err.error || 'Unable to analyze content.');
  }
});

uploadButton.addEventListener('click', () => {
  fileInput.click();
});

authToggle.addEventListener('click', () => {
  authCard.classList.toggle('hidden');
});

logoutButton.addEventListener('click', async () => {
  try {
    await fetchJson('/api/logout', { method: 'POST' });
    currentUser = null;
    renderUserState();
  } catch (err) {
    alert(err.error || 'Logout failed.');
  }
});

loginButton.addEventListener('click', async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) return alert('Email and password are required.');

  try {
    const data = await fetchJson('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    currentUser = data.user;
    renderUserState();
    authCard.classList.add('hidden');
  } catch (err) {
    alert(err.error || 'Login failed.');
  }
});

registerButton.addEventListener('click', async () => {
  const email = registerEmail.value.trim();
  const password = registerPassword.value;
  if (!email || !password) return alert('Email and password are required.');

  try {
    const data = await fetchJson('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    currentUser = data.user;
    renderUserState();
    authCard.classList.add('hidden');
  } catch (err) {
    alert(err.error || 'Registration failed.');
  }
});

loadCurrentUser();
