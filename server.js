const express = require('express');
const path    = require('path');

const app  = express();
const PORT = 3000;

// Servir todos los archivos estáticos (HTML, CSS, JS, imágenes)
app.use(express.static(path.join(__dirname)));

// Ruta raíz → index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ FantasyPro corriendo en http://localhost:${PORT}`);
});
