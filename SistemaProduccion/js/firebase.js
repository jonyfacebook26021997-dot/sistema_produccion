// firebase.js - Configuración de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Configuración de tu proyecto
const firebaseConfig = {
    apiKey: "AIzaSyBrgepLE66VmIbLX2FK5Pvw8ldTiHY1a10",
    authDomain: "sistemaproduccion-1cf69.firebaseapp.com",
    projectId: "sistemaproduccion-1cf69",
    storageBucket: "sistemaproduccion-1cf69.firebasestorage.app",
    messagingSenderId: "673896576310",
    appId: "1:673896576310:web:eafe4ee37cf4c35223af97"
};

// Inicializar la aplicación de Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore y Authentication
const db = getFirestore(app);
const auth = getAuth(app);

// Exportar módulos para usarlos en el resto de tu app
export {
    db,
    auth,
    collection,
    addDoc,
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    query,
    where,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
};