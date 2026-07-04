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
- Python (solo para el parser del chat)
- PWA: manifest + service worker
- Sin frameworks, sin build step
