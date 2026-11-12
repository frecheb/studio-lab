# StudioLab — Versión web para GitHub Pages

**StudioLab / Una aplicación de Fernando Reche**  
Versión 3

Aplicación web estática para estudiar mediante cuestionarios. Esta edición está preparada para publicarse en **GitHub Pages** y carga automáticamente `datos/preguntas.json`.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub.
2. Descomprime este paquete.
3. Sube al repositorio **el contenido de la carpeta `StudioLab`**, no el ZIP.
4. Comprueba que `index.html` está en la raíz del repositorio y que existe `datos/preguntas.json`.
5. En GitHub, entra en **Settings → Pages**.
6. En **Build and deployment**, selecciona **Deploy from a branch**.
7. Selecciona la rama `main` y la carpeta `/(root)`, y guarda.
8. Espera a que GitHub Pages termine la publicación y abre la URL que te proporciona GitHub.

La aplicación utiliza una ruta relativa (`./datos/preguntas.json`), por lo que funciona tanto en un sitio de usuario como en un sitio de proyecto, por ejemplo `https://usuario.github.io/nombre-del-repositorio/`.

## Estructura necesaria

Mantén esta estructura y los nombres de carpetas/archivos exactamente como aparecen:

```text
StudioLab/
├── index.html
├── favicon.svg
├── LEEME.md
├── css/
│   └── styles.css
├── js/
│   └── app.js
└── datos/
    └── preguntas.json
```

**Importante:** GitHub distingue entre mayúsculas y minúsculas. `datos/preguntas.json` debe tener exactamente ese nombre y esa ruta.

## Cambiar o añadir cuestionarios

- Para cambiar el cuestionario que se carga automáticamente, sustituye `datos/preguntas.json` por otro JSON con el mismo nombre.
- Para cargar un cuestionario distinto solo durante tu sesión, utiliza el botón **Cargar otro JSON**.
- Después de subir cambios, espera a que GitHub Pages los publique. Si el navegador conserva una versión anterior, realiza una recarga forzada.

## Funciones

- Carga automática del JSON predeterminado.
- Carga manual de otros archivos JSON.
- Preguntas tipo test, selección múltiple y respuesta corta.
- Selección múltiple con entre 1 y 4 respuestas correctas.
- Orden aleatorio de preguntas y opciones.
- Corrección inmediata, puntuación sobre 10 y revisión final.
- Diseño adaptable a escritorio, tableta y móvil.

## Cuestionario incluido

El paquete incluye `datos/preguntas.json` con las 100 preguntas de Entornos de Desarrollo.

## Ejecutar en local

También puedes abrir la carpeta con Visual Studio Code y utilizar Live Server. No es necesario instalar dependencias ni utilizar Node.js.

Abrir `index.html` directamente mediante `file://` puede impedir la carga automática del JSON por las restricciones del navegador. En ese caso, utiliza Live Server o el selector **Cargar otro JSON**.

## Privacidad y funcionamiento

StudioLab es una aplicación estática: no requiere cuenta, servidor de base de datos ni dependencias externas. Las respuestas se procesan en el navegador y no se envían a un servidor.
