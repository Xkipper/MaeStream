// Configuración
//const channelInput = document.getElementById('channelName');
//const chatLog = document.getElementById('chatLog');
const channelInput = 'horoowolf';
const isDice = false;
let client = null;
const elements = {
	source:		document.querySelector('#source'),
	audio:		document.querySelector('#audio'),
};
elements.audio.addEventListener('ended', end);

// Inicializar el Cliente TTS del Navegador ---
const synth = window.speechSynthesis;
const ttsQueue = [];
let isSpeaking = false;


/*
Tik Tok Voces

es_002
es_male_m3
es_female_f6
es_female_fp1
es_mx_002
es_mx_female_supermom


// Ejemplo (Puede estar sujeto a cambios o bloqueos por parte de Google)
const text = "Hola Mundo";
const lang = "es";
const encodedText = encodeURIComponent(text);
const url = `http://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${lang}&client=tw`;

const audio = new Audio(url);
audio.play();

*/

const tiktokVoces = [ 'es_002', 'es_male_m3', 'es_female_f6', 'es_female_fp1', 'es_mx_002', 'es_mx_female_supermom'];


// Procesa la cola de mensajes TTS
async function processQueue() {
    if (ttsQueue.length > 0 && !isSpeaking) {
        isSpeaking = true;
        const textToSpeak = ttsQueue.shift();


        const url = 'https://tiktok-tts.weilnet.workers.dev/api/generation';
		const options = {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{"text":"' + textToSpeak + '","voice":"' + tiktokVoces[1] + '"}',
		};
		try {
			const response = await fetch(url, options);
			const data = await response.json();
			if (data === null) {
				console.error(`TikTok TTS Generation failed ("${data.error}")`);
                // llamar a tts suplente
				ttsSuplente(textToSpeak);		
				return;
			}
			else {
				//console.info('TikTok TTS - OK', data);
				elements.source.src = `data:audio/mpeg;base64,${data.data}`;
				const audio = elements.audio;
				await audio.load();				
				audio.play();
			}
		}
		catch (e) {
			console.error(e);
			console.log('If the error code is 503, the service is currently unavailable. Please try again later.');
			// llamar a tts suplente
			ttsSuplente(textToSpeak);
			return;
		}
        
    }
}

// Función de TTS Suplente
async function ttsSuplente(textToSpeak) {
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
        
    // Opcional: Elige una voz (puedes ajustar o dejar que el navegador use la predeterminada)
    const voices = synth.getVoices();
    //console.info(voices)
    //utterance.voice = voices.find(v => v.name.includes('Sabina')); 
    utterance.voice = voices[4]

    utterance.onend = () => {
        isSpeaking = false;
        processQueue(); // Procesa el siguiente mensaje
    };

    utterance.onerror = (event) => {
        console.error('Error de TTS:', event);
        isSpeaking = false;
        processQueue(); // Pasa al siguiente
    };

    synth.speak(utterance);
}

// Audio Ended Event
function end() {
	setTimeout(() => {
		isSpeaking = false;
		processQueue();		
	}, 1500);

}

// Función de Limpieza y Filtrado de Mensajes ---
function cleanMessage(message, tags) {
    let cleanedMessage = message;

        
    // Patrón para eliminar emojis Unicode (bastante robusto, pero no perfecto):
    //cleanedMessage = cleanedMessage.replace(/([\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\u2019|\u2600-\u26FF|\u2700-\u27BF)/g, '').trim();

    // 1. Filtrar Emotes de Twitch
    if (tags.emotes){
        const cul = Object.values(tags.emotes);
        const pen = Object.values(cul[0]);

        for (let i = 0; i < pen.length; i++) {
            const tmp = pen[i].split("-");
            const emoteCode = message.substring(tmp[0], (tmp[1]+1));
            cleanedMessage = cleanedMessage.replaceAll(emoteCode, "");
        }

    }

    // 2. Filtrar comandos
    if (cleanedMessage.startsWith('!')) { // Comandos
        return null; // No leer comandos
    }

    // 3. Filtro de longitud mínima de texto
    if (cleanedMessage.length < 3) {
        return null;
    }

    // 4. Filtrar links
    if (cleanedMessage.indexOf('http') > -1) return null;
	if (cleanedMessage.indexOf('www.') > -1) return null;

    return cleanedMessage;

}

// Conexión a Twitch Chat y Manejo de Mensajes ---
function connectToChat() {
    const channelName = channelInput.toLowerCase();
    if (!channelName) {
        alert("Por favor, ingresa un nombre de canal.");
        return;
    }

    // Desconectar si ya está conectado
    if (client) {
        client.disconnect();
        client = null;
        chatLog.innerHTML = `<p style="color: orange;">Desconectado del canal anterior.</p>`;
    }

    // Crear un nuevo cliente tmi.js
    client = new tmi.Client({
        channels: [channelName]
    });

    client.on('message', (channel, tags, message, self) => {
        if (self) return; // Ignorar nuestros propios mensajes (si estuviéramos logueados)
        let ignorarEstos = 'nightbot BotRixOficial StreamElements own3d';    // Listado de nicks a ignorar
		ignorarEstos = ignorarEstos.toLowerCase();

        // Limpiar y filtrar el mensaje
        const cleanedMessage = cleanMessage(message, tags);

        // Mostrar en el registro (opcional, para depuración)
        const username = tags['display-name'].toLowerCase() || tags.username.toLowerCase();

        // Ignorar los nicks. Pueden ser nombres de usuarios o Bots
        if (ignorarEstos.indexOf(username) > -1) return;

        /*
        const newLog = document.createElement('p');
        newLog.innerHTML = `<span style="color: ${tags.color || '#FFFFFF'}; font-weight: bold;">${username}:</span> ${message}`;
        chatLog.prepend(newLog); // Agrega el mensaje al inicio
        */

        if (cleanedMessage) {
            const ttsMessage = isDice ? `${username} dice: ${cleanedMessage}` : cleanedMessage;
            ttsQueue.push(ttsMessage);
            processQueue(); // Intenta procesar la cola
        }
    });

    client.on('connected', (addr, port) => {
        //chatLog.innerHTML = `<p style="color: green; font-weight: bold;">Conectado a #${channelName}</p>` + chatLog.innerHTML;
        // Precargar voces (necesario para Firefox y algunas versiones de Chrome)
        if (synth.getVoices().length === 0) {
            synth.onvoiceschanged = processQueue;
        } else {
            processQueue();
        }
    });

    client.on('disconnected', (reason) => {
        //chatLog.innerHTML = `<p style="color: red; font-weight: bold;">Desconectado: ${reason}</p>` + chatLog.innerHTML;
        // Detener la lectura si se desconecta
        if (synth.speaking) {
            synth.cancel();
            isSpeaking = false;
            ttsQueue.length = 0;
        }
    });

    client.connect().catch(err => {
        //chatLog.innerHTML = `<p style="color: red;">Error al conectar: ${err.message}</p>` + chatLog.innerHTML;
        console.error('Error de conexión:', err);
    });
}

connectToChat();


