// public/script.js
// Full, self-contained client script for room.html

(() => {
  try {
    console.log("script.js: boot");

    const socket = io();
    const params = new URLSearchParams(location.search);
    const room = params.get("room");
    const name = params.get("name") || "User";
    const isHost = params.get("host") === "true";

    let localStream;
    const peers = {};
    const waitingUsers = {};
    const remoteNames = {};
    let participantNames = { self: name || "You" };
    let participantVideoStates = {};
    let participantAudioStates = {};

    let hostNameFromServer = null;
    let unreadChat = 0;
    let waitingCount = 0;
    const REMOTES_PER_PAGE = 3;
    let remoteOrder = [];
    let remotePage = 0;

    let myDrawColor = "#ff0000";
    let xrayCanvas = null;
    let xrayCtx = null;
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let shapeStartX = 0;
    let shapeStartY = 0;
    let currentTool = "pen";
    let strokes = [];
    let redoStack = [];

    const topbarTitle = document.getElementById("topbar-title");
    const selfNameLabel = document.getElementById("self-name-label");
    const selfAvatar = document.getElementById("self-avatar");
    const selfAvatarInitial = document.getElementById("self-avatar-initial");
    const selfAvatarName = document.getElementById("self-avatar-name");

    const chatPanel = document.getElementById("chat-panel");
    const waitingPanel = document.getElementById("waiting-panel");
    const infoPanel = document.getElementById("info-panel");
    const participantsPanel = document.getElementById("participants-panel");

    const infoBody = document.getElementById("info-body");
    const participantsList = document.getElementById("participants-list");

    const chatBadge = document.getElementById("chat-badge");
    const waitingBadge = document.getElementById("waiting-badge");
    if (chatBadge) chatBadge.style.display = "none";
    if (waitingBadge) waitingBadge.style.display = "none";

    const waitingBtn = document.getElementById("waiting-btn");
    const chatBtn = document.getElementById("chat-btn");
    const infoBtn = document.getElementById("info-btn");
    const participantsBtn = document.getElementById("participants-btn");
    const endBtn = document.getElementById("end-btn");
    const themeToggleBtn = document.getElementById("theme-toggle");
    const body = document.body;

    const xrayInput = document.getElementById("xrayInput");
    const xrayImage = document.getElementById("xrayImage");
    const xrayView = document.getElementById("xray-view");
    const analyzeBtn = document.getElementById("analyzeBtn");
    const xrayInfo = document.getElementById("xray-info");

    const toolIds = [
      "tool-pen", "tool-erase", "tool-circle", "tool-square",
      "tool-triangle", "tool-undo", "tool-redo", "tool-clear"
    ];

    let _lastSystemMessage = { text: "", ts: 0 };
    const SYSTEM_MSG_DEDUPE_WINDOW_MS = 2000;

    function enforceNoMirror() {
      document.querySelectorAll("video").forEach(v => { try { v.style.transform = "none"; } catch (e) { } });
    }

    function setTileVideoState(tileId, enabled) {
      const tile = document.getElementById(tileId);
      if (!tile) return;
      tile.classList.toggle("video-off", !enabled);

      const v = tile.querySelector("video");
      if (v) v.style.display = enabled ? "" : "none";

      const avatarCircle = tile.querySelector(".avatar-circle");
      const avatarName = tile.querySelector(".avatar-name");
      if (avatarCircle && avatarName) {
        const nameText = avatarName.textContent || (tile.dataset && tile.dataset.name);
        if (nameText) avatarCircle.textContent = nameText.trim()[0].toUpperCase();
      }
    }

    function attachToolButtons() {
      toolIds.forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (id === "tool-undo" || id === "tool-redo" || id === "tool-clear") {
          btn.onclick = () => handleToolAction(id.replace("tool-", ""));
        } else {
          btn.onclick = () => selectTool(id.replace("tool-", ""));
        }
      });
      selectTool("pen");
    }

    if (topbarTitle) topbarTitle.textContent = `Med-Zoom AI - ${room || ""}`;
    if (selfNameLabel) selfNameLabel.textContent = name ? `${name} (You)` : "You";
    const displayName = name || "You";
    if (selfAvatarName) selfAvatarName.textContent = displayName;
    if (selfAvatarInitial) selfAvatarInitial.textContent = (displayName.trim()[0] || "U").toUpperCase();

    if (!isHost && waitingBtn) waitingBtn.style.display = "none";

    if (endBtn) {
      if (isHost) { endBtn.textContent = "End"; endBtn.classList.add("end-btn"); }
      else { endBtn.textContent = "Leave"; endBtn.classList.add("leave-btn"); }
      endBtn.onclick = () => {
        if (isHost) {
          const ok = confirm("End meeting for everyone?");
          if (!ok) return;
          socket.emit("end-meeting", { room });
        }
        leaveMeeting();
      };
    }

    const savedTheme = localStorage.getItem("mz-theme");
    if (savedTheme === "dark") body.classList.add("dark-theme");
    if (themeToggleBtn) {
      themeToggleBtn.textContent = body.classList.contains("dark-theme") ? "☀️" : "🌙";
      themeToggleBtn.onclick = () => {
        const isDark = body.classList.toggle("dark-theme");
        themeToggleBtn.textContent = isDark ? "☀️" : "🌙";
        localStorage.setItem("mz-theme", isDark ? "dark" : "light");
      };
    }

    attachToolButtons();

    socket.on("your-color", color => { myDrawColor = color || "#ff0000"; });

    socket.on("room-info", ({ room: r, code, hostName, lastXray, participants, videoStates, audioStates }) => {
      hostNameFromServer = hostName;
      if (infoBody) {
        const inviteUrl = `${window.location.origin}/room.html?room=${encodeURIComponent(r)}&name=Guest&host=false`;
        infoBody.innerHTML = `<p><b>Room:</b> ${r}</p><p><b>Passcode:</b> ${code}</p><p><b>Host:</b> ${hostName}</p><p><b>Invite link:</b><br><span class="invite-link">${inviteUrl}</span></p>`;
      }

      // Use server authoritative participants
      if (Array.isArray(participants)) {
        participantNames = { self: name || "You" };
        participantVideoStates = {};
        participantAudioStates = {};
        remoteOrder = [];

        participants.forEach(p => {
          if (!p || !p.socketId) return;
          participantNames[p.socketId] = p.name || "Participant";
          participantVideoStates[p.socketId] = true;
          participantAudioStates[p.socketId] = true;
          remoteOrder.push(p.socketId);
        });
      }

      if (videoStates) Object.entries(videoStates).forEach(([id, st]) => participantVideoStates[id] = !!st);
      if (audioStates) Object.entries(audioStates).forEach(([id, st]) => participantAudioStates[id] = !!st);

      renderParticipants();
      if (lastXray) renderXrayCanvas(lastXray);
    });

    socket.on('participant-list', ({ participants }) => {
      try {
        participantNames = { self: name || "You" };
        participantVideoStates = {};
        participantAudioStates = {};
        remoteOrder = [];

        (participants || []).forEach(p => {
          if (!p || !p.socketId) return;
          participantNames[p.socketId] = p.name || "Participant";
          participantVideoStates[p.socketId] = true;
          participantAudioStates[p.socketId] = true;
          remoteOrder.push(p.socketId);
        });

        renderParticipants();
        updateRemotePagination();
      } catch (e) {
        console.warn("participant-list handler error:", e);
      }
    });

    // fallback info
    if (infoBody && !infoBody.innerHTML.trim()) {
      const inviteUrl = `${window.location.origin}/room.html?room=${encodeURIComponent(room || "")}&name=Guest&host=false`;
      infoBody.innerHTML = `<p><b>Room:</b> ${room || "-"}</p><p><b>Passcode:</b> (shared by host)</p><p><b>Host:</b> ${isHost ? (name || "You") : "Host"}</p><p><b>Invite link:</b><br><span class="invite-link">${inviteUrl}</span></p>`;
    }

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localStream = stream;
        const myVideo = document.getElementById("myVideo");
        if (myVideo) {
          myVideo.srcObject = stream;
          myVideo.muted = true;
          myVideo.play().catch(() => { });
          myVideo.style.objectFit = "cover";
          myVideo.style.transform = "none";
        }
        enforceNoMirror();

        if (isHost) {
          appendSystemMessage("You are the host of this meeting.");
          socket.emit("join-room", { room, name, isHost: true });
        } else {
          appendSystemMessage("Waiting for host to admit you...");
          socket.emit("request-join", { room, name });
        }

        renderParticipants();
      }).catch(err => {
        console.error("Media error:", err);
        appendSystemMessage("Camera / Mic permission blocked.");
      });

    socket.on("join-request", ({ socketId, name: requesterName }) => {
      if (!isHost) return;
      waitingUsers[socketId] = requesterName;
      renderWaitingList();
      waitingCount = Object.keys(waitingUsers).length;
      updateBadge(waitingBadge, waitingCount);
      appendSystemMessage(`${requesterName} is waiting to join.`);
    });

    function updateWaitingBadge() {
      if (!waitingBadge) return;
      const count = Object.keys(waitingUsers).length;
      if (count > 0 && !waitingPanel.classList.contains("open")) updateBadge(waitingBadge, count);
      else updateBadge(waitingBadge, 0);
    }

    function renderWaitingList() {
      const listDiv = document.getElementById("waiting-list");
      if (!listDiv) return;
      listDiv.innerHTML = "";
      const entries = Object.entries(waitingUsers);
      if (entries.length === 0) { listDiv.innerHTML = "<small>No one is waiting.</small>"; updateWaitingBadge(); return; }

      entries.forEach(([id, userName]) => {
        const row = document.createElement("div");
        row.textContent = `${userName} wants to join`;

        const acceptBtn = document.createElement("button");
        acceptBtn.className = "wait-btn wait-accept";
        acceptBtn.textContent = "✓ Approve";
        acceptBtn.onclick = () => {
          socket.emit("approve-join", { targetSocketId: id, room });
          delete waitingUsers[id];
          renderWaitingList();
          updateWaitingBadge();
        };

        const rejectBtn = document.createElement("button");
        rejectBtn.className = "wait-btn wait-reject";
        rejectBtn.textContent = "✕ Deny";
        rejectBtn.onclick = () => {
          socket.emit("reject-join", { targetSocketId: id, room });
          delete waitingUsers[id];
          renderWaitingList();
          updateWaitingBadge();
        };

        row.appendChild(acceptBtn);
        row.appendChild(rejectBtn);
        listDiv.appendChild(row);
      });
    }

    socket.on("join-approved", () => {
      appendSystemMessage("Host approved your request. Joining meeting...");
      socket.emit("join-room", { room, name, isHost: false });
    });

    socket.on("join-rejected", ({ reason }) => appendSystemMessage(reason || "Host denied your request."));

    // ====== WebRTC signaling: user-joined (replace existing handler) ======
    socket.on("user-joined", async ({ socketId, name: remoteName }) => {
      // If already connected to this peer, ignore
      if (peers[socketId]) {
        console.warn('already have peer for', socketId);
        return;
      }
      // store name as early as possible (server should send it; but be defensive)
      remoteNames[socketId] = remoteName || remoteNames[socketId] || participantNames[socketId] || "Participant";
      participantNames[socketId] = remoteNames[socketId];
      participantVideoStates[socketId] = participantVideoStates[socketId] ?? true;
      participantAudioStates[socketId] = participantAudioStates[socketId] ?? true;

      appendSystemMessage(`${remoteNames[socketId]} joined the meeting.`);
      renderParticipants();

      // create peer, send offer
      try {
        const pc = createPeerConnection(socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: socketId, sdp: pc.localDescription });
      } catch (err) {
        console.error("Error creating offer for", socketId, err);
      }
    });


    socket.on("offer", async ({ from, sdp }) => {
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { to: from, sdp: pc.localDescription });
    });

    socket.on("answer", async ({ from, sdp }) => {
      const pc = peers[from];
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on("ice-candidate", async ({ from, candidate }) => {
      const pc = peers[from];
      if (!pc || !candidate) return;
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { console.error("ICE error", e); }
    });

    socket.on("user-left", ({ socketId, name: remoteName }) => {
      const tile = document.getElementById("tile-" + socketId);
      if (tile) tile.remove();
      const pc = peers[socketId];
      if (pc) { pc.close(); delete peers[socketId]; }

      delete participantNames[socketId];
      delete participantVideoStates[socketId];
      delete participantAudioStates[socketId];
      renderParticipants();

      remoteOrder = remoteOrder.filter(id => id !== socketId);
      updateRemotePagination();
      appendSystemMessage(`${remoteName || "Someone"} left the meeting.`);
    });

    socket.on("room-ended", () => {
      if (!isHost) {
        try {
          const infoModal = document.getElementById("info-modal");
          const infoTitle = document.getElementById("info-title");
          const infoMsg = document.getElementById("info-message");
          if (infoModal && infoTitle && infoMsg) {
            infoTitle.textContent = "Meeting Ended";
            infoMsg.textContent = "The host has ended the meeting. You will be returned to the dashboard.";
            infoModal.classList.remove("hidden");
            const okBtn = infoModal.querySelector("button.btn.primary");
            if (okBtn) okBtn.onclick = () => { infoModal.classList.add("hidden"); leaveMeeting(); };
          } else { alert("Host ended the meeting."); leaveMeeting(); }
        } catch (e) { console.error("Error showing host-ended modal:", e); leaveMeeting("host_ended"); }
      } else { appendSystemMessage("Host ended the meeting."); leaveMeeting(); }
    });

    socket.on("xray-result", data => renderXrayCanvas(data));

    socket.on("draw-op", data => {
      if (!xrayCanvas || !xrayCtx) return;
      if (data.action === "add" && data.stroke) { strokes.push(data.stroke); redoStack.length = 0; redrawStrokes(); }
      else if (data.action === "undo") { if (strokes.length) { redoStack.push(strokes.pop()); redrawStrokes(); } }
      else if (data.action === "redo") { if (redoStack.length) { strokes.push(redoStack.pop()); redrawStrokes(); } }
      else if (data.action === "clear") { strokes = []; redoStack = []; redrawStrokes(); }
    });

    socket.on("video-state", ({ socketId, enabled }) => {
      participantVideoStates[socketId] = !!enabled;
      if (socketId === socket.id) {
        setTileVideoState("self-tile", enabled);
        const selfTile = document.getElementById("self-tile");
        if (selfTile) selfTile.classList.toggle("video-off", !enabled);
      } else {
        setTileVideoState("tile-" + socketId, enabled);
        const tile = document.getElementById("tile-" + socketId);
        if (tile) tile.classList.toggle("video-off", !enabled);
      }
      renderParticipants();
    });

    socket.on("audio-state", ({ socketId, enabled }) => {
      participantAudioStates[socketId] = !!enabled;
      renderParticipants();
    });

    // call in console to inspect problematic peer
    function inspectPeer(socketId) {
      const pc = peers[socketId];
      if (!pc) return console.warn("no pc for", socketId);
      console.log("pc.getReceivers()", pc.getReceivers());
      pc.getReceivers().forEach(r => {
        console.log("receiver:", r.track && r.track.kind, "enabled:", r.track && r.track.enabled, "id:", r.track && r.track.id);
      });
      const tile = document.getElementById("tile-" + socketId);
      if (tile) console.log("tile video srcObject:", tile.querySelector("video").srcObject);
    }
    window.inspectPeer = inspectPeer;


    // peer connection helpers
    function createPeerConnection(remoteSocketId) {
      if (peers[remoteSocketId]) return peers[remoteSocketId];

      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

      // add local tracks if available
      if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      // Robust ontrack: handle event.streams empty and multiple track deliveries
      pc.ontrack = event => {
        try {
          // Try to get the stream from event.streams (works in many browsers)
          let stream = (event.streams && event.streams[0]) ? event.streams[0] : null;

          // If stream is missing, create/merge a MediaStream from track(s)
          if (!stream) {
            stream = new MediaStream();
            // add the primary incoming track
            if (event.track) stream.addTrack(event.track);

            // also add all currently available receiver tracks for this pc (to merge)
            try {
              pc.getReceivers().forEach(r => {
                if (r && r.track && !stream.getTracks().includes(r.track)) {
                  stream.addTrack(r.track);
                }
              });
            } catch (e) {
              // ignore if getReceivers not available
            }
          }

          // call your existing helper: attach or update tile
          addRemoteVideo(remoteSocketId, stream, remoteNames[remoteSocketId]);
        } catch (err) {
          console.warn("ontrack handler error for", remoteSocketId, err);
        }
      };

      pc.onicecandidate = event => {
        if (event.candidate) socket.emit("ice-candidate", { to: remoteSocketId, candidate: event.candidate });
      };

      peers[remoteSocketId] = pc;
      return pc;
    }


    // Add/Update remote video tile (replace previous function)
    function addRemoteVideo(socketId, stream, remoteName) {
      const grid = document.getElementById("remote-grid");
      if (!grid) return;

      const displayName = remoteName || participantNames[socketId] || remoteNames[socketId] || "Participant";
      remoteNames[socketId] = displayName;
      participantNames[socketId] = participantNames[socketId] || displayName;

      // If tile exists, attach tracks to existing video element (merge)
      let tile = document.getElementById("tile-" + socketId);
      if (tile) {
        const v = tile.querySelector("video");
        if (v) {
          // Merge tracks: if srcObject exists, add any missing tracks; otherwise set srcObject
          const existing = v.srcObject;
          if (!existing) {
            try { v.srcObject = stream; } catch (e) { v.src = window.URL.createObjectURL(stream); }
          } else {
            // add new tracks from incoming stream to existing MediaStream (avoids replace)
            try {
              stream.getTracks().forEach(t => {
                if (!existing.getTracks().some(et => et.id === t.id)) existing.addTrack(t);
              });
            } catch (e) {
              // fallback to replace the entire srcObject
              try { v.srcObject = stream; } catch (er) { v.src = window.URL.createObjectURL(stream); }
            }
          }
        }

        tile.dataset.name = displayName;
        const avatarName = tile.querySelector(".avatar-name");
        const smallName = tile.querySelector(".video-name");
        if (avatarName) avatarName.textContent = displayName;
        if (smallName) smallName.textContent = displayName;

        const enabled = participantVideoStates.hasOwnProperty(socketId) ? participantVideoStates[socketId] : true;
        tile.classList.toggle("video-off", !enabled);
        return;
      }

      // Create tile
      tile = document.createElement("div");
      tile.className = "remote-tile";
      tile.id = "tile-" + socketId;
      tile.style.position = "relative";
      tile.dataset.name = displayName;

      // video element
      const video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.className = "tile-video";
      video.style.objectFit = "cover";
      video.style.transform = "none";

      // IMPORTANT: start muted to avoid autoplay being blocked in some browsers.
      // We'll allow the user to unmute on click.
      video.muted = true;

      // Attach stream robustly
      try {
        // if stream is a MediaStream, set it
        if (stream instanceof MediaStream) video.srcObject = stream;
        else video.src = stream; // fallback (unlikely)
      } catch (e) {
        console.warn("Couldn't set srcObject (addRemoteVideo):", e);
        try { video.src = window.URL.createObjectURL(stream); } catch (err) { console.warn(err); }
      }

      // bottom-left label
      const nameLabel = document.createElement("div");
      nameLabel.className = "video-name";
      nameLabel.textContent = displayName;

      // avatar overlay (shown when video-off)
      const avatarBox = document.createElement("div");
      avatarBox.className = "video-avatar";
      const avatarCircle = document.createElement("div");
      avatarCircle.className = "avatar-circle";
      avatarCircle.textContent = (displayName && displayName.trim()[0]) ? displayName.trim()[0].toUpperCase() : "?";
      const avatarName = document.createElement("div");
      avatarName.className = "avatar-name";
      avatarName.textContent = displayName;
      avatarBox.appendChild(avatarCircle);
      avatarBox.appendChild(avatarName);

      // Small helper: try play, if autoplay blocked then keep muted and show click-to-unmute
      const tryPlay = async () => {
        try {
          await video.play();
          // success: unmute if you want to allow audio for remote automatically
          // but keep muted=true to avoid blocking on some clients. Uncomment to auto-unmute:
          // video.muted = false;
        } catch (err) {
          // autoplay blocked: video remains muted so frames should still play,
          // but if frames still don't appear we'll keep muted and allow user to enable audio.
          console.warn("Autoplay/play() blocked for remote video", socketId, err);
        }
      };

      // allow user to toggle audio by clicking tile
      tile.addEventListener("click", () => {
        try {
          if (video.muted) {
            video.muted = false;
            // attempt to play audio as well
            video.play().catch(e => console.warn("Play after unmute failed:", e));
          } else {
            video.muted = true;
          }
        } catch (e) { console.warn("toggle mute error", e); }
      });

      // assemble and append
      tile.appendChild(video);
      tile.appendChild(avatarBox);
      tile.appendChild(nameLabel);
      grid.appendChild(tile);

      // initial video-off state if known
      const initialEnabled = participantVideoStates.hasOwnProperty(socketId) ? participantVideoStates[socketId] : true;
      tile.classList.toggle("video-off", !initialEnabled);

      if (!remoteOrder.includes(socketId)) remoteOrder.push(socketId);

      // try playing now
      tryPlay().catch(() => { });
      enforceNoMirror();
      updateRemotePagination();
    }

    function updateRemotePagination() {
      const total = remoteOrder.length;
      const grid = document.getElementById("remote-grid");
      const indicator = document.getElementById("remote-page-indicator");
      if (!grid) return;

      const totalPages = Math.max(1, Math.ceil(total / REMOTES_PER_PAGE));
      if (remotePage >= totalPages) remotePage = totalPages - 1;

      remoteOrder.forEach((id, index) => {
        const tile = document.getElementById("tile-" + id);
        if (!tile) return;
        const page = Math.floor(index / REMOTES_PER_PAGE);
        tile.style.display = page === remotePage ? "flex" : "none";
      });

      if (indicator) indicator.textContent = total === 0 ? "0/0" : `${remotePage + 1}/${totalPages}`;
    }

    document.getElementById("remote-prev")?.addEventListener("click", () => {
      if (remoteOrder.length === 0) return;
      const totalPages = Math.ceil(remoteOrder.length / REMOTES_PER_PAGE);
      remotePage = (remotePage - 1 + totalPages) % totalPages;
      updateRemotePagination();
    });

    document.getElementById("remote-next")?.addEventListener("click", () => {
      if (remoteOrder.length === 0) return;
      const totalPages = Math.ceil(remoteOrder.length / REMOTES_PER_PAGE);
      remotePage = (remotePage + 1) % totalPages;
      updateRemotePagination();
    });

    function updateBadge(badgeEl, count) {
      if (!badgeEl) return;
      if (count > 0) { badgeEl.textContent = count; badgeEl.style.display = "inline-block"; }
      else badgeEl.style.display = "none";
    }

    function refreshChatBadge() {
      const b = document.getElementById("chat-badge");
      if (!b) return;
      if (unreadChat > 0) { b.textContent = unreadChat; b.style.display = "inline-block"; } else b.style.display = "none";
    }

    function refreshWaitingBadge() {
      const b = document.getElementById("waiting-badge");
      if (!b) return;
      if (waitingCount > 0) { b.textContent = waitingCount; b.style.display = "inline-block"; } else b.style.display = "none";
    }

    // Controls
    document.getElementById("audio-btn")?.addEventListener("click", toggleAudio);
    document.getElementById("video-btn")?.addEventListener("click", toggleVideo);
    document.getElementById("share-btn")?.addEventListener("click", shareScreen);

    chatBtn && (chatBtn.onclick = () => {
      togglePanel(chatPanel, chatBtn);
      if (chatPanel.classList.contains("open")) { unreadChat = 0; updateChatBadge(); }
    });
    infoBtn && (infoBtn.onclick = () => togglePanel(infoPanel, infoBtn));
    participantsBtn && (participantsBtn.onclick = () => { togglePanel(participantsPanel, participantsBtn); renderParticipants(); });
    waitingBtn && (waitingBtn.onclick = () => togglePanel(waitingPanel, waitingBtn));
    analyzeBtn && (analyzeBtn.onclick = analyzeXray);

    function toggleAudio() {
      if (!localStream) return;
      const track = localStream.getAudioTracks()[0];
      if (!track) return;
      track.enabled = !track.enabled;
      const audioBtn = document.getElementById("audio-btn");
      const audioIcon = audioBtn ? audioBtn.querySelector(".zoom-icon") : null;
      if (track.enabled) { audioBtn?.classList.remove("off"); if (audioIcon) audioIcon.textContent = "🎙️"; }
      else { audioBtn?.classList.add("off"); if (audioIcon) audioIcon.textContent = "🔇"; }
      participantAudioStates[socket.id] = track.enabled;
      socket.emit("audio-state", { room, enabled: track.enabled });
      renderParticipants();
    }

    function toggleVideo() {
      if (!localStream) return;
      const track = localStream.getVideoTracks()[0];
      if (!track) return;
      track.enabled = !track.enabled;
      const enabled = track.enabled;
      const videoBtn = document.getElementById("video-btn");
      if (enabled) videoBtn?.classList.remove("off"); else videoBtn?.classList.add("off");
      setTileVideoState("self-tile", enabled);
      participantVideoStates[socket.id] = enabled;
      socket.emit("video-state", { room, enabled });
      renderParticipants();
    }

    async function shareScreen() {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        for (let id in peers) {
          const sender = peers[id].getSenders().find(s => s.track && s.track.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        }
        const myVideo = document.getElementById("myVideo");
        myVideo.srcObject = screenStream;
        enforceNoMirror();
        screenTrack.onended = () => {
          if (!localStream) return;
          const camTrack = localStream.getVideoTracks()[0];
          myVideo.srcObject = localStream;
          enforceNoMirror();
          for (let id in peers) {
            const sender = peers[id].getSenders().find(s => s.track && s.track.kind === "video");
            if (sender) sender.replaceTrack(camTrack);
          }
        };
      } catch (e) { console.error("Screen share error:", e); }
    }

    function updateChatBadge() {
      const b = document.getElementById("chat-badge");
      if (!b) return;
      if (unreadChat > 0) { b.textContent = unreadChat; b.style.display = "inline-block"; } else b.style.display = "none";
    }

    socket.on("chat-message", data => {
      const senderLabel = data.name === name ? "You" : data.name;
      appendChatMessage(senderLabel, data.message);
      const chatPanelOpen = chatPanel && chatPanel.classList.contains("open");
      if (!chatPanelOpen && data.name !== name) { unreadChat++; updateChatBadge(); }
    });

    socket.on("system-message", text => appendSystemMessage(text));

    const chatInput = document.getElementById("chat-input");
    if (chatInput) chatInput.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    const chatSendBtn = document.getElementById("chat-send-btn");
    if (chatSendBtn) chatSendBtn.onclick = sendMessage;

    function sendMessage() {
      const input = document.getElementById("chat-input");
      if (!input) return;
      const message = input.value.trim();
      if (!message) return;
      socket.emit("chat-message", { name, room, message });
      input.value = "";
    }

    function appendChatMessage(sender, text) {
      const box = document.getElementById("chat-box");
      if (!box) return;
      const isMe = sender === "You" || sender === (name || "You");
      const div = document.createElement("div");
      div.className = `chat-item ${isMe ? "me" : "other"}`;
      const bubble = document.createElement("div");
      bubble.className = "chat-bubble";
      bubble.innerHTML = `<b>${sender}:</b> ${escapeHtml(text)}`;
      div.appendChild(bubble);
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    }

    function escapeHtml(str) {
      if (!str) return "";
      return str.replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
    }

    function appendSystemMessage(text) {
      try {
        const now = Date.now();
        if (text === _lastSystemMessage.text && (now - _lastSystemMessage.ts) < SYSTEM_MSG_DEDUPE_WINDOW_MS) return;
        _lastSystemMessage = { text, ts: now };
      } catch (e) { console.warn("Dedupe guard failed:", e); }
      const box = document.getElementById("chat-box");
      if (!box) return;
      const div = document.createElement("div");
      div.className = "chat-system-message";
      div.textContent = text;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    }

    function openPanel(panel, btn) { closeAllPanels(); if (!panel) return; panel.classList.add("open"); if (btn) btn.classList.add("selected"); if (panel === chatPanel) { unreadChat = 0; updateChatBadge(); } }
    function closePanel(panel, btn) { if (!panel) return; panel.classList.remove("open"); if (btn) btn.classList.remove("selected"); }
    function closeAllPanels() { [chatPanel, participantsPanel, waitingPanel, infoPanel].forEach(p => p && p.classList.remove("open"));[chatBtn, participantsBtn, waitingBtn, infoBtn].forEach(b => b && b.classList.remove("selected")); }
    function togglePanel(panel, btn) { if (!panel) return; const isOpen = panel.classList.contains("open"); closeAllPanels(); if (!isOpen) openPanel(panel, btn); }
    document.querySelectorAll(".panel-close").forEach(btn => btn.onclick = () => { const panel = btn.closest(".panel-slide"); if (panel) closePanel(panel); });

    function renderParticipants() {
      if (!participantsList) return;
      participantsList.innerHTML = "";

      const aggregated = new Map();
      const selfKey = socket.id || "self";
      const selfDisplay = participantNames["self"] || (name || "You");
      aggregated.set(selfDisplay, { name: selfDisplay, keys: [selfKey], micOn: participantAudioStates[selfKey] ?? true, videoOn: participantVideoStates[selfKey] ?? true });

      Object.entries(participantNames).forEach(([key, pName]) => {
        if (key === "self" || key === selfKey) return;
        const display = pName || "Participant";
        const existing = aggregated.get(display);
        const mic = participantAudioStates[key] ?? true;
        const vid = participantVideoStates[key] ?? true;
        if (existing) {
          existing.keys.push(key);
          existing.micOn = existing.micOn || mic;
          existing.videoOn = existing.videoOn || vid;
        } else {
          aggregated.set(display, { name: display, keys: [key], micOn: mic, videoOn: vid });
        }
      });

      if (aggregated.size === 0) { participantsList.innerHTML = "<small>No participants yet.</small>"; return; }

      aggregated.forEach(entry => {
        const row = document.createElement("div"); row.className = "participant-row";
        const leftBox = document.createElement("div"); leftBox.className = "participant-left";
        const nameSpan = document.createElement("span"); nameSpan.className = "participant-name"; nameSpan.textContent = entry.name; leftBox.appendChild(nameSpan);
        const tagBox = document.createElement("div"); tagBox.className = "participant-tags";
        if (hostNameFromServer && entry.name === hostNameFromServer) { const hostTag = document.createElement("span"); hostTag.className = "participant-tag-host"; hostTag.textContent = "Host"; tagBox.appendChild(hostTag); }
        const selfId = socket.id;
        if (entry.keys.includes(selfId) || entry.keys.includes("self")) { const youTag = document.createElement("span"); youTag.className = "participant-tag-you"; youTag.textContent = "You"; tagBox.appendChild(youTag); }
        if (tagBox.childElementCount > 0) leftBox.appendChild(tagBox);
        row.appendChild(leftBox);
        const avBox = document.createElement("div"); avBox.className = "participant-av";
        const micBadge = document.createElement("span"); micBadge.className = `av-badge mic ${entry.micOn ? "on" : "off"}`; micBadge.textContent = entry.micOn ? "🎙" : "🔇"; avBox.appendChild(micBadge);
        const camBadge = document.createElement("span"); camBadge.className = `av-badge video ${entry.videoOn ? "on" : "off"}`; camBadge.textContent = entry.videoOn ? "🎥" : "🚫"; avBox.appendChild(camBadge);
        row.appendChild(avBox);
        participantsList.appendChild(row);
      });
    }

    function selectTool(tool) {
      currentTool = tool;
      document.querySelectorAll(".draw-tool-btn").forEach(b => b.classList.remove("active"));
      const active = document.getElementById("tool-" + tool);
      if (active) active.classList.add("active");
    }

    function handleToolAction(action) {
      if (!xrayCanvas || !xrayCtx) return;
      if (action === "undo") { if (!strokes.length) return; redoStack.push(strokes.pop()); redrawStrokes(); socket.emit("draw-op", { room, action: "undo" }); }
      else if (action === "redo") { if (!redoStack.length) return; strokes.push(redoStack.pop()); redrawStrokes(); socket.emit("draw-op", { room, action: "redo" }); }
      else if (action === "clear") { strokes = []; redoStack = []; redrawStrokes(); socket.emit("draw-op", { room, action: "clear" }); }
    }

    function attachDrawingHandlers() {
      if (!xrayCanvas) return;
      function getCanvasPos(e) {
        const rect = xrayCanvas.getBoundingClientRect();
        const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
        const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
        const xDisplay = clientX - rect.left;
        const yDisplay = clientY - rect.top;
        const x = xDisplay * (xrayCanvas.width / rect.width);
        const y = yDisplay * (xrayCanvas.height / rect.height);
        return { x, y };
      }
      function pointerDown(e) {
        e.preventDefault(); isDrawing = true;
        const { x, y } = getCanvasPos(e); lastX = x; lastY = y; shapeStartX = x; shapeStartY = y;
        if (currentTool === "pen" || currentTool === "erase") {
          const normX = x / xrayCanvas.width, normY = y / xrayCanvas.height;
          const stroke = { tool: currentTool === "erase" ? "erase" : "pen", color: myDrawColor, size: currentTool === "erase" ? 16 : 3, points: [{ x: normX, y: normY }] };
          xrayCanvas._currentStroke = stroke;
        }
      }
      function pointerMove(e) {
        if (!isDrawing) return; e.preventDefault();
        const { x, y } = getCanvasPos(e);
        if (currentTool === "pen" || currentTool === "erase") {
          const stroke = xrayCanvas._currentStroke; if (!stroke) return;
          const lastPoint = stroke.points[stroke.points.length - 1];
          const lastPx = lastPoint.x * xrayCanvas.width, lastPy = lastPoint.y * xrayCanvas.height;
          drawStrokeSegment(lastPx, lastPy, x, y, stroke);
          stroke.points.push({ x: x / xrayCanvas.width, y: y / xrayCanvas.height });
        } else if (["circle", "square", "triangle"].includes(currentTool)) {
          lastX = x; lastY = y; redrawStrokes();
          const previewStroke = { tool: currentTool, color: myDrawColor, size: 3, x0: shapeStartX / xrayCanvas.width, y0: shapeStartY / xrayCanvas.height, x1: lastX / xrayCanvas.width, y1: lastY / xrayCanvas.height };
          drawShapeStroke(previewStroke); return;
        }
        lastX = x; lastY = y;
      }
      function pointerUp(e) {
        if (!isDrawing) return; e.preventDefault(); isDrawing = false;
        if (currentTool === "pen" || currentTool === "erase") {
          const stroke = xrayCanvas._currentStroke;
          if (stroke && stroke.points.length > 1) { strokes.push(stroke); redoStack = []; socket.emit("draw-op", { room, action: "add", stroke }); }
          xrayCanvas._currentStroke = null;
        } else if (["circle", "square", "triangle"].includes(currentTool)) {
          const normX0 = shapeStartX / xrayCanvas.width; const normY0 = shapeStartY / xrayCanvas.height;
          const normX1 = lastX / xrayCanvas.width; const normY1 = lastY / xrayCanvas.height;
          const stroke = { tool: currentTool, color: myDrawColor, size: 3, x0: normX0, y0: normY0, x1: normX1, y1: normY1 };
          strokes.push(stroke); redoStack = []; redrawStrokes(); socket.emit("draw-op", { room, action: "add", stroke });
        }
      }
      xrayCanvas.onmousedown = pointerDown; xrayCanvas.onmousemove = pointerMove; window.onmouseup = pointerUp;
      xrayCanvas.ontouchstart = pointerDown; xrayCanvas.ontouchmove = pointerMove; window.ontouchend = pointerUp;
    }

    function drawStrokeSegment(x0, y0, x1, y1, stroke) {
      if (!xrayCtx) return;
      if (stroke.tool === "erase") xrayCtx.globalCompositeOperation = "destination-out"; else xrayCtx.globalCompositeOperation = "source-over";
      xrayCtx.strokeStyle = stroke.color; xrayCtx.lineWidth = stroke.size; xrayCtx.lineCap = "round";
      xrayCtx.beginPath(); xrayCtx.moveTo(x0, y0); xrayCtx.lineTo(x1, y1); xrayCtx.stroke(); xrayCtx.globalCompositeOperation = "source-over";
    }

    function drawShapeStroke(stroke) {
      if (!xrayCtx || !xrayCanvas) return;
      const w = xrayCanvas.width, h = xrayCanvas.height;
      const x0 = stroke.x0 * w, y0 = stroke.y0 * h, x1 = stroke.x1 * w, y1 = stroke.y1 * h;
      xrayCtx.globalCompositeOperation = "source-over"; xrayCtx.strokeStyle = stroke.color; xrayCtx.lineWidth = stroke.size; xrayCtx.beginPath();
      if (stroke.tool === "circle") { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2, r = Math.max(rx, ry); xrayCtx.arc(cx, cy, r, 0, Math.PI * 2); }
      else if (stroke.tool === "square") { const left = Math.min(x0, x1), top = Math.min(y0, y1), size = Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)); xrayCtx.rect(left, top, size, size); }
      else if (stroke.tool === "triangle") { const left = Math.min(x0, x1), right = Math.max(x0, x1), top = Math.min(y0, y1), bottom = Math.max(y0, y1), midX = (left + right) / 2; xrayCtx.moveTo(midX, top); xrayCtx.lineTo(left, bottom); xrayCtx.lineTo(right, bottom); xrayCtx.closePath(); }
      xrayCtx.stroke(); xrayCtx.globalCompositeOperation = "source-over";
    }

    function redrawStrokes() {
      if (!xrayCtx || !xrayCanvas) return;
      xrayCtx.clearRect(0, 0, xrayCanvas.width, xrayCanvas.height);
      strokes.forEach(stroke => {
        if (["pen", "erase"].includes(stroke.tool)) {
          for (let i = 1; i < stroke.points.length; i++) {
            const p0 = stroke.points[i - 1], p1 = stroke.points[i];
            drawStrokeSegment(p0.x * xrayCanvas.width, p0.y * xrayCanvas.height, p1.x * xrayCanvas.width, p1.y * xrayCanvas.height, stroke);
          }
        } else drawShapeStroke(stroke);
      });
    }

    async function analyzeXray() {
      if (!isHost) { appendSystemMessage("Only the host can analyze X-rays."); return; }
      const file = xrayInput?.files?.[0];
      if (!file) { if (xrayInfo) xrayInfo.innerHTML = "<span style='color:red;'>Please select an X-ray image.</span>"; return; }
      if (xrayInfo) xrayInfo.innerHTML = "Analyzing X-ray...";

      const formData = new FormData(); formData.append("image", file);
      const endpoints = ["/predict", "http://127.0.0.1:5000/predict", "http://127.0.0.1:5001/predict"];
      const fetchWithTimeout = (url, options = {}, timeoutMs = 15000) => {
        const controller = new AbortController(); const id = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
      };

      let lastError = null;
      for (const url of endpoints) {
        try {
          const resp = await fetchWithTimeout(url, { method: "POST", body: formData }, 15000);
          if (!resp.ok) { let txt = ""; try { txt = await resp.text(); } catch (e) { txt = `HTTP ${resp.status}` } lastError = `Server returned ${resp.status} from ${url}: ${txt}`; console.warn(lastError); continue; }
          const ctype = resp.headers.get("content-type") || "";
          if (!ctype.includes("application/json")) { const text = await resp.text(); lastError = `Non-JSON response from ${url}: ${text}`; console.warn(lastError); continue; }
          const data = await resp.json();
          if (data.error) { if (xrayInfo) xrayInfo.innerHTML = `<span style='color:red;'>Error: ${data.error}</span>`; appendSystemMessage("AI server error: " + data.error); return; }
          renderXrayCanvas({ from: name, result: data.result, confidence: data.confidence, image: data.image });
          appendSystemMessage(`X-ray analyzed: ${data.result} (confidence ${Number(data.confidence || 0).toFixed(4)})`);
          socket.emit("xray-result", { room, from: name, result: data.result, confidence: data.confidence, image: data.image });
          return;
        } catch (err) {
          if (err.name === "AbortError") lastError = `Timeout contacting ${url}`; else lastError = `Network error contacting ${url}: ${err.message || err}`;
          console.warn(lastError);
        }
      }
      console.error("analyzeXray: all endpoints failed. Last error:", lastError);
      if (xrayInfo) xrayInfo.innerHTML = `<span style='color:red;'>Failed: ${lastError}</span>`;
      appendSystemMessage("Failed to analyze X-ray. See console for details.");
    }

    function renderXrayCanvas(data) {
      const img = document.getElementById("xrayImage");
      const canvas = document.getElementById("xrayCanvas");
      const placeholder = document.getElementById("xrayPlaceholder");
      const resultBox = document.getElementById("xray-info");
      if (!img || !canvas) return;
      if (resultBox) resultBox.innerHTML = `<b>Analyzed by:</b> ${data.from}<br><b>Diagnosis:</b> ${data.result}<br><b>Confidence:</b> ${Number(data.confidence || 0).toFixed(4)}`;
      img.onload = () => {
        if (placeholder) placeholder.style.display = "none";
        img.style.display = "block";
        canvas.style.display = "block";
        canvas.width = img.clientWidth; canvas.height = img.clientHeight;
        xrayCanvas = canvas; xrayCtx = canvas.getContext("2d"); strokes = []; redoStack = []; attachDrawingHandlers(); redrawStrokes();
      };
      img.src = "data:image/png;base64," + (data.image || "");
    }

    function leaveMeeting(reason) {
      for (let id in peers) peers[id].close();
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      try { socket.disconnect(); } catch (e) { }
      let url = "dashboard.html"; if (reason) url += `?reason=${encodeURIComponent(reason)}`;
      window.location.href = url;
    }

    // Report generation via secure server endpoint
    async function generateXrayReport() {
      const output = document.getElementById("xray-report-box");
      const infoEl = document.getElementById("xray-info");
      if (!infoEl || !infoEl.innerText.includes("Diagnosis:")) {
        if (output) output.innerHTML = "<span style='color:red;'>Analyze an X-ray first.</span>";
        return;
      }
      const diagnosis = infoEl.innerText.split("Diagnosis:")[1].split("\n")[0].trim();
      if (!diagnosis) {
        if (output) output.innerHTML = "<span style='color:red;'>No diagnosis found.</span>";
        return;
      }
      if (output) output.innerHTML = "✨ Generating medical report...";

      try {
        const resp = await fetch("/api/generate-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ diagnosis })
        });
        const data = await resp.json();
        if (!data.ok) {
          if (output) output.innerHTML = `<span style='color:red;'>Error: ${data.error || "Failed to create report"}</span>`;
          return;
        }
        if (output) output.innerHTML = data.report;
      } catch (err) {
        console.error("Report generation request error:", err);
        if (output) output.innerHTML = "<span style='color:red;'>Network error while generating report.</span>";
      }
    }

    window.generateXrayReport = generateXrayReport;
    window.analyzeXray = analyzeXray;

    console.log("script.js: initialized successfully");
  } catch (err) {
    console.error("script.js top-level error:", err);
  }
})();
