# Súper Motos - Catálogo Digital

Catálogo web responsive + PWA para repuestos de moto, generado automáticamente desde un chat de WhatsApp exportado.

## Características

- Catálogo navegable con búsqueda en tiempo real
- Filtros por categoría
- Vista de imágenes con lightbox y carrusel
- Carrito de cotización persistente (localStorage)
- Envío de pedidos por WhatsApp
- Exportación a PDF (vista de impresión)
- Modo edición: renombrar/eliminar productos "sin nombre" desde la UI
- PWA instalable + uso offline
- 100% estático, sin backend

## Estructura

```
.
├── index.html              # HTML principal
├── index.css               # Estilos
├── index.js                # Lógica de la app
├── config.js               # Configuración (número WhatsApp, mensajes)
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── catalogo.json           # Catálogo de productos
├── overrides.json          # Correcciones manuales (opcional)
├── parse_chat.py           # Regenera catalogo.json desde el chat
├── assets/
│   ├── icon-192.png        # Ícono PWA
│   ├── icon-512.png        # Ícono PWA
│   └── images/             # 672 imágenes de productos
└── chat-source/            # Copia del chat original
    └── Chat de WhatsApp con +57 319 6220658.txt
```

## Cómo regenerar el catálogo

```bash
python parse_chat.py
```

Esto lee `chat-source/` y `assets/images/` y produce `catalogo.json` actualizado.

## Cómo editar/eliminar productos manualmente

Dos opciones:

1. **Desde la UI** (modo edición): click en el ícono de lápiz ✏️ en cada producto
2. **Editando `overrides.json`** (persistente entre navegadores):

```json
[
  {"id": 1, "description": "Nombre correcto", "category": "Categoría"}
]
```

## Configuración

Editar `config.js`:

```js
const APP_CONFIG = {
    businessName: "Súper Motos",
    whatsappNumber: "573508814535",  // número destino de los pedidos
    contactPhone: "+57 3508814535",
    showEditMode: true  // false = ocultar botones de edición en la UI
};
```

## Deploy

### GitHub Pages

1. Subir a un repo público
2. Settings → Pages → Source: `main` branch, `/ (root)`
3. URL: `https://USUARIO.github.io/REPO/`

### Local

```bash
python -m http.server 8000
# Abrir http://localhost:8000
```

## Stack técnico

- HTML + CSS + JavaScript vanilla
- Python (para el parser y el procesamiento de imágenes)
- PWA: manifest + service worker
- Sin frameworks, sin build step

## Cómo quitar el fondo de las imágenes

El proyecto cuenta con un script de procesamiento de imágenes con Inteligencia Artificial (`quitar_fondo.py`) para limpiar el fondo de las fotos en lote.

```bash
python quitar_fondo.py
```

* **Funcionamiento:** Utiliza el modelo de alta precisión `isnet-general-use` de la librería `rembg`.
* **Configuración:** Por defecto, aplica un fondo blanco sólido a las siluetas recortadas y guarda el archivo en formato `.jpg` para conservar los nombres de archivo originales y asegurar compatibilidad directa.
* **Respaldo:** Las imágenes originales antes de procesar se guardan en la carpeta `assets/images_originales_backup/` (excluida del control de versiones en `.gitignore` para no saturar el repositorio).

## Próximas Características / Roadmap

- [ ] **Solucionar carrito de compras:** Corregir errores en la lógica interna detectados recientemente.
- [ ] **Cambiar a color corporativo:** Adaptar los estilos visuales a la marca corporativa de Súper Motos.
- [ ] **Ponerle el logo oficial:** Agregar el logo oficial de la marca al encabezado.

