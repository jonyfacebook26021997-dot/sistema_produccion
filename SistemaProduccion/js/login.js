import {
    auth,
    signInWithEmailAndPassword
} from "./firebase.js";

async function ingresar(){

    const usuario =
    document.getElementById("usuario").value;

    const clave =
    document.getElementById("clave").value;

    try{

        await signInWithEmailAndPassword(auth, usuario, clave);

        window.location="menu.html";

    }
    catch(error){

        document.getElementById("mensaje").innerHTML =
        "Correo o contraseña incorrectos";

    }

}

window.ingresar = ingresar;