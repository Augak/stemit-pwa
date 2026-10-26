(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fileInput = $('audioFile'), dropzone = $('dropzone'), fileCard = $('fileCard');
  const processBtn = $('processBtn'), progressWrap = $('progressWrap');
  const resultSection = $('resultSection'), canvas = $('waveform');
  const ctx = canvas.getContext('2d');
  let sourceBuffer = null, resultBuffer = null, selectedMode = 'vocals';
  let audioContext = null, player = null, currentUrl = null, fileName = '', installPrompt = null, isMuted = false;
  const audioExtensions = /\.(wav|mp3|m4a|ogg|flac|aac|webm|opus)$/i;
  const formatTime = seconds => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
  };
  const setStatus = (message, percent) => {
    $('progressText').textContent = message;
    $('progressPct').textContent = percent + '%';
    $('progressBar').style.width = percent + '%';
  };
  async function getAudioContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('This browser does not support audio processing. Try a recent version of Chrome.');
    if (!audioContext) audioContext = new Ctx();
    if (audioContext.state === 'suspended') await audioContext.resume();
    return audioContext;
  }
  function releasePlayer() {
    if (player) { try { player.pause(); player.removeAttribute('src'); player.load(); } catch (_) {} player = null; }
    if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }
  }
  function clearResult() {
    releasePlayer(); resultBuffer = null; resultSection.hidden = true;
    $('playBtn').textContent = '▶'; $('seekBar').value = '0';
    $('currentTime').textContent = '0:00'; $('duration').textContent = '0:00';
  }
  function showFile(file) {
    if (!file) return;
    if (!(file.type.startsWith('audio/') || audioExtensions.test(file.name))) {
      alert('Please choose a supported audio file.'); fileInput.value = ''; return;
    }
    if (file.size > 100 * 1024 * 1024) {
      alert('This prototype recommends files under 50 MB. Very large files may exceed your phone’s available memory.'); 
    }
    fileName = file.name;
    $('fileName').textContent = file.name;
    $('fileInfo').textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB · Loading audio…';
    fileCard.hidden = false; processBtn.disabled = true; clearResult();
    getAudioContext().then(ctx => file.arrayBuffer().then(data => ctx.decodeAudioData(data))).then(buffer => {
      sourceBuffer = buffer;
      $('fileInfo').textContent = formatTime(buffer.duration) + ' · ' + buffer.numberOfChannels + ' channel(s) · Ready';
      processBtn.disabled = false;
    }).catch(err => {
      sourceBuffer = null; processBtn.disabled = true;
      $('fileInfo').textContent = 'Could not decode this file';
      alert('Unable to read this audio file. Try a WAV or MP3 file. ' + (err.message || ''));
    });
  }
  fileInput.addEventListener('change', e => showFile(e.target.files && e.target.files[0]));
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault(); dropzone.classList.remove('dragover');
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if (file) showFile(file);
  });
  $('removeFile').addEventListener('click', () => {
    sourceBuffer = null; fileInput.value = ''; fileCard.hidden = true; processBtn.disabled = true; clearResult();
  });
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    selectedMode = button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(card => {
      const active = card === button;
      card.classList.toggle('selected', active);
      card.querySelector('.mode-select').innerHTML = active ? 'Selected <b>✓</b>' : 'Select <b>＋</b>';
    });
    if (!resultSection.hidden) clearResult();
  }));
  function processBuffer(buffer, mode) {
    const channels = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
    const out = audioContext.createBuffer(2, buffer.length, buffer.sampleRate);
    const left = channels[0], right = channels.length > 1 ? channels[1] : channels[0];
    const outL = out.getChannelData(0), outR = out.getChannelData(1);
    for (let i = 0; i < buffer.length; i++) {
      if (mode === 'vocals') {
        // Centre extraction: approximate mono centre; this is not AI source separation.
        const mid = (left[i] + right[i]) * 0.5;
        outL[i] = mid; outR[i] = mid;
      } else {
        // Side extraction: phase-difference signal suppresses some centre-panned content.
        const side = (left[i] - right[i]) * 0.5;
        outL[i] = side; outR[i] = -side;
      }
    }
    return out;
  }
  function drawWaveform(buffer) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(320, Math.floor(canvas.clientWidth * dpr));
    const height = Math.floor(76 * dpr);
    canvas.width = width; canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#b7f36b'; ctx.globalAlpha = 0.8; ctx.lineWidth = Math.max(1, dpr);
    const data = buffer.getChannelData(0), step = Math.max(1, Math.floor(data.length / width));
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      let peak = 0;
      for (let j = 0; j < step && x * step + j < data.length; j++) peak = Math.max(peak, Math.abs(data[x * step + j]));
      const y = (height / 2) - peak * (height * 0.43);
      const y2 = (height / 2) + peak * (height * 0.43);
      ctx.moveTo(x, y); ctx.lineTo(x, Math.max(y + dpr, y2));
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  function bufferToWav(buffer) {
    const channels = 2, frames = buffer.length, sampleRate = buffer.sampleRate;
    const bytes = 44 + frames * channels * 2;
    const array = new ArrayBuffer(bytes), view = new DataView(array);
    const write = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
    write(0, 'RIFF'); view.setUint32(4, bytes - 8, true); write(8, 'WAVE'); write(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, frames * channels * 2, true);
    const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
    let offset = 44;
    for (let i = 0; i < frames; i++) {
      for (const sample of [left[i], right[i]]) {
        const s = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true); offset += 2;
      }
    }
    return new Blob([array], {type:'audio/wav'});
  }
  processBtn.addEventListener('click', async () => {
    if (!sourceBuffer) return;
    processBtn.disabled = true; progressWrap.hidden = false; resultSection.hidden = true;
    try {
      await getAudioContext(); setStatus('Preparing audio…', 15);
      await new Promise(resolve => setTimeout(resolve, 30));
      resultBuffer = processBuffer(sourceBuffer, selectedMode); setStatus('Building preview…', 75);
      releasePlayer();
      const wav = bufferToWav(resultBuffer); currentUrl = URL.createObjectURL(wav);
      player = new Audio(currentUrl); player.preload = 'metadata'; player.muted = isMuted;
      $('resultTitle').textContent = selectedMode === 'vocals' ? 'Vocal focus' : 'Instrumental focus';
      $('resultSub').textContent = selectedMode === 'vocals' ? 'Stereo centre extraction · approximation' : 'Stereo side extraction · approximation';
      $('duration').textContent = formatTime(resultBuffer.duration);
      player.addEventListener('timeupdate', () => {
        if (!player) return;
        $('currentTime').textContent = formatTime(player.currentTime);
        $('seekBar').value = player.duration ? String(Math.round(player.currentTime / player.duration * 1000)) : '0';
      });
      player.addEventListener('ended', () => { $('playBtn').textContent = '▶'; });
      drawWaveform(resultBuffer); setStatus('Ready to listen', 100); resultSection.hidden = false;
      resultSection.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
    } catch (err) { alert('Audio processing failed: ' + (err.message || err)); }
    finally { processBtn.disabled = !sourceBuffer; }
  });
  $('playBtn').addEventListener('click', async () => {
    if (!player) return;
    try {
      if (player.paused) { await player.play(); $('playBtn').textContent = 'Ⅱ'; }
      else { player.pause(); $('playBtn').textContent = '▶'; }
    } catch (err) { alert('Playback could not start. Tap play again.'); }
  });
  $('seekBar').addEventListener('input', e => {
    if (player && Number.isFinite(player.duration)) player.currentTime = (Number(e.target.value) / 1000) * player.duration;
  });
  $('muteBtn').addEventListener('click', () => {
    isMuted = !isMuted; if (player) player.muted = isMuted;
    $('muteBtn').textContent = isMuted ? '×' : '♫';
    $('muteBtn').setAttribute('aria-label', isMuted ? 'Unmute audio' : 'Mute audio');
  });
  $('downloadBtn').addEventListener('click', () => {
    if (!resultBuffer) return;
    const blob = bufferToWav(resultBuffer), url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = (fileName.replace(/\.[^.]+$/, '') || 'stemit-audio').replace(/[^a-z0-9-_]+/gi, '-');
    a.href = url; a.download = base + '-' + selectedMode + '.wav'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  });
  $('newTrackBtn').addEventListener('click', () => {
    sourceBuffer = null; fileInput.value = ''; fileCard.hidden = true; processBtn.disabled = true; clearResult();
    $('studio').scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('helpBtn').addEventListener('click', () => $('helpDialog').showModal());
  $('closeHelp').addEventListener('click', () => $('helpDialog').close());
  $('helpDialog').addEventListener('click', e => { if (e.target === $('helpDialog')) $('helpDialog').close(); });
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); installPrompt = e; $('installBtn').hidden = false;
  });
  $('installBtn').addEventListener('click', async () => {
    if (!installPrompt) { alert('To install on Android, open this site in Chrome, tap the menu, then choose “Install app” or “Add to Home screen”.'); return; }
    installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $('installBtn').hidden = true;
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
  document.querySelectorAll('.side-nav a').forEach(link => link.addEventListener('click', () => {
    document.querySelectorAll('.side-nav a').forEach(item => item.classList.toggle('active', item === link));
  }));
})();