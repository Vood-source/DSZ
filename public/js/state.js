export const state = {
    username: localStorage.getItem('discordCloneUsername') || '',
    userAvatar: localStorage.getItem('discordCloneAvatar') || '',
    userStatus: localStorage.getItem('discordCloneStatus') || '',
    roomId: '',
    localStream: null,
    localScreenStream: null,
    peerConnections: {},
    screenPeerConnections: {},
    isMuted: false,
    isDeafened: false,
    currentAudioElements: {},
    users: {},
    messages: [],
    videoElements: {},
    socket: null // Будет инициализирован в main.js
};

export function updateState(key, value) {
    state[key] = value;
}