import os
import re
import json

# Paths relative to the script location (Antigravity_prueba1) - Self-contained project
script_dir = os.path.dirname(os.path.abspath(__file__))
chat_folder_name = "Chat de WhatsApp con +57 319 6220658"
chat_path = os.path.join(script_dir, "chat-source", chat_folder_name, chat_folder_name + ".txt")
images_dir = os.path.join(script_dir, "assets", "images")
output_json = os.path.join(script_dir, "catalogo.json")
overrides_path = os.path.join(script_dir, "overrides.json")

# Relative URL path for the images in the web app
relative_img_dir = "assets/images"


def get_category(description):
    desc = description.lower()
    if "pastilla" in desc:
        return "Pastillas de Freno"
    elif "filtro aire" in desc or "filtro de aire" in desc:
        return "Filtros de Aire"
    elif "filtro" in desc:
        return "Filtros"
    elif ("cdi" in desc or "rectificador" in desc or "bobina" in desc
          or "regulador" in desc or "bujia" in desc or "bujía" in desc
          or "relay" in desc or "flashear" in desc or "spark" in desc):
        return "Sistema Electrico"
    elif ("swiche" in desc or "switch" in desc or "comando" in desc
          or "trompo stop" in desc or "llave de contacto" in desc or "llave encendido" in desc):
        return "Controles y Switches"
    elif ("bombillo" in desc or "direccional" in desc or "exploradora" in desc
          or "farola" in desc or "iluminacion" in desc or "iluminación" in desc
          or "aleta farola" in desc or "coca direccional" in desc or "gorra farola" in desc):
        return "Iluminacion / Luces"
    elif ("stop" in desc or "tapa" in desc or "guardabarro" in desc
          or "carenaje" in desc or "forro" in desc or "aleron" in desc or "alerón" in desc
          or "fender" in desc or "portaplaca" in desc or "visera" in desc):
        return "Carenaje, Tapas y Stops"
    elif ("manigueta" in desc or "portamanigueta" in desc or "manilar" in desc
          or "elevador cabrilla" in desc or "protector manigueta" in desc):
        return "Manubrio y Maniguetas"
    elif "espejo" in desc or "base espejo" in desc:
        return "Espejos"
    elif ("pata lateral" in desc or "crank" in desc or "pedal" in desc
          or "gato" in desc or "caucho pedal" in desc):
        return "Patas y Pedales"
    elif "empaque" in desc or "empaques" in desc:
        return "Empaques"
    elif ("cadena" in desc or "piñón" in desc or "pinton" in desc
          or "plato" in desc or "arrastre" in desc or "sprocket" in desc
          or "cadenilla" in desc or "guarda cadena" in desc or "correa transmision" in desc
          or "correa trasmisión" in desc or "buje porta" in desc or "porta sprocket" in desc
          or "deslizador cadenilla" in desc or "deslizador cadena" in desc or "caucho deslizador" in desc):
        return "Transmision y Arrastre"
    elif "bomba" in desc:
        return "Bombas (Freno/Aceite)"
    elif ("cigueñal" in desc or "balancín" in desc or "balancines" in desc
          or "válvula" in desc or "valvula" in desc or "árbol" in desc or "arbol" in desc
          or "biela" in desc or "motor" in desc or "silicona motor" in desc
          or "kit cilindro" in desc or "kit piston" in desc or "pistón" in desc or "piston" in desc):
        return "Repuestos de Motor"
    elif ("disco clutch" in desc or "disco clucht" in desc or "prensa clutch" in desc
          or "prensa clucht" in desc or "discos de clutch" in desc or "embrague" in desc):
        return "Embrague"
    elif "balinera" in desc or "ruleman" in desc or "rodamiento" in desc or "rodamientos" in desc:
        return "Rodamientos"
    elif "cuna" in desc or "cunas" in desc or "cuñas" in desc:
        return "Direccion"
    elif "campana" in desc:
        return "Transmision y Arrastre"
    elif "freno de disco" in desc or "freno disco" in desc or "protector disco" in desc:
        return "Sistema de Freno"
    elif "candado" in desc:
        return "Transmision y Arrastre"
    elif ("lujo" in desc or "slider" in desc or "slaider" in desc
          or "manguera gasolina" in desc or "manguera blindada" in desc
          or "varilla" in desc or "abrazadera" in desc or "leva freno" in desc
          or "tapa tornillo" in desc or "forros de defensa" in desc
          or "porta celular" in desc or "carburador" in desc):
        return "Accesorios y Lujos"
    elif "radios" in desc or "radio" in desc:
        return "Ruedas"
    elif "pdf" in desc or "catalogo" in desc or "catálogo" in desc or "distribuciones" in desc or "oferta" in desc:
        return "Catalogos / PDF"
    elif ("kit carburador" in desc or "freno" in desc or "cortavientos" in desc
          or "chapaleta" in desc or "alcatraz" in desc or "frontal" in desc
          or "resorte freno" in desc or "canastilla" in desc or "canasta" in desc):
        return "Otros / Varios"
    else:
        return "Otros / Varios"


def load_overrides():
    if os.path.exists(overrides_path):
        try:
            with open(overrides_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return {item["id"]: item for item in data if "id" in item}
        except Exception as e:
            print(f"Advertencia: No se pudo leer overrides.json: {e}")
    return {}


def apply_overrides(products, overrides):
    if not overrides:
        return products
    for p in products:
        if p["id"] in overrides:
            ov = overrides[p["id"]]
            if "description" in ov and ov["description"]:
                p["description"] = ov["description"]
            if "category" in ov and ov["category"]:
                p["category"] = ov["category"]
    return products


def load_existing_prices_and_renames():
    rename_map = {}
    price_map = {}
    if os.path.exists(output_json):
        try:
            with open(output_json, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    for item in data:
                        filenames = item.get("filenames", [])
                        orig_filenames = item.get("original_filenames", [])
                        desc = item.get("description", "")
                        price = item.get("price", 0)
                        
                        # Mapear nombres de archivos
                        for idx, fn in enumerate(filenames):
                            orig_fn = orig_filenames[idx] if idx < len(orig_filenames) else fn
                            rename_map[orig_fn] = fn
                            
                        # Mapear precio por descripción
                        if desc:
                            clean_key = " ".join(desc.lower().split())
                            price_map[clean_key] = price
        except Exception as e:
            print(f"Advertencia: No se pudo leer catalogo.json para el mapa de precios/renombres: {e}")
    return rename_map, price_map



def parse_chat():
    chat_source_root = os.path.join(script_dir, "chat-source")
    if not os.path.exists(chat_source_root):
        print(f"Error: No se encontró la carpeta raíz de chats en: {chat_source_root}")
        return

    # Buscar todos los archivos .txt de chat recursivamente en chat-source/
    chat_files = []
    for root, dirs, files in os.walk(chat_source_root):
        for file in files:
            if file.endswith(".txt"):
                chat_files.append(os.path.join(root, file))

    if not chat_files:
        print(f"Error: No se encontraron archivos .txt de chat en: {chat_source_root}")
        return

    # Cargar mapa de archivos ya renombrados y precios existentes para mantener la consistencia
    rename_map, price_map = load_existing_prices_and_renames()
    if rename_map:
        print(f"Cargado mapa de renombres previos con {len(rename_map)} asociaciones.")
    if price_map:
        print(f"Cargado mapa de precios previos con {len(price_map)} registros.")


    pattern = re.compile(r"^\d{1,2}/\d{1,2}/\d{4},\s\d{1,2}:\d{2}\s-\s([^:]+):\s\u200e?([^\(]+)\s\(archivo adjunto\)")

    products = []

    for chat_path in chat_files:
        print(f"Procesando archivo de chat: {os.path.basename(chat_path)}")
        try:
            with open(chat_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except Exception as e:
            print(f"Error al leer {chat_path}: {e}")
            continue

        current_product = None

        for i, line in enumerate(lines):
            line = line.strip()
            # Quitar marcas de formato invisibles de WhatsApp si existen al inicio
            line = line.lstrip('\ufeff\u200e\u200f')
            match = pattern.match(line)
            if match:
                if current_product:
                    products.append(current_product)

                sender = match.group(1)
                filename = match.group(2).strip()

                current_product = {
                    "id": len(products) + 1,
                    "sender": sender,
                    "filename": filename,
                    "description": ""
                }
            elif current_product:
                if re.match(r"^\d{1,2}/\d{1,2}/\d{4},\s\d{1,2}:\d{2}\s-\s", line):
                    products.append(current_product)
                    current_product = None
                else:
                    if line:
                        if current_product["description"]:
                            current_product["description"] += "\n" + line
                        else:
                            current_product["description"] = line

        if current_product:
            products.append(current_product)

    EXCLUDED_FILES = {"IMG-20260504-WA0000.jpg"}

    files_in_dir = set(os.listdir(images_dir))
    grouped_products = {}
    skipped_no_desc = 0

    for p in products:
        filename = p["filename"]
        
        # Saltamos archivos PDF en esta sección de imágenes del catálogo
        if filename.lower().endswith(".pdf"):
            continue

        if filename in EXCLUDED_FILES:
            continue

        # Usar el nombre renombrado si ya existe en el mapa de renombres previos
        actual_filename = rename_map.get(filename, filename)
        found = False

        if actual_filename in files_in_dir:
            found = True
        else:
            cleaned_filename = re.sub(r'[^\w\.\-\s]', '', actual_filename)
            if cleaned_filename in files_in_dir:
                actual_filename = cleaned_filename
                found = True

        if found:
            desc = p["description"].strip()
            is_unknown = False
            if not desc:
                skipped_no_desc += 1
                continue

            clean_key = " ".join(desc.lower().split())
            image_path = f"{relative_img_dir}/{actual_filename}"

            if clean_key not in grouped_products:
                grouped_products[clean_key] = {
                    "id": len(grouped_products) + 1,
                    "description": desc,
                    "category": get_category(desc),
                    "is_unknown": is_unknown,
                    "images": [image_path],
                    "filenames": [actual_filename],
                    "original_filenames": [filename],
                    "price": price_map.get(clean_key, 0) # Conservar precio si ya existía
                }
            else:
                # Agrupar múltiples fotos en el mismo producto
                if image_path not in grouped_products[clean_key]["images"]:
                    grouped_products[clean_key]["images"].append(image_path)
                    grouped_products[clean_key]["filenames"].append(actual_filename)
                    grouped_products[clean_key]["original_filenames"].append(filename)
                if is_unknown:
                    grouped_products[clean_key]["is_unknown"] = True

    final_products = list(grouped_products.values())

    overrides = load_overrides()
    final_products = apply_overrides(final_products, overrides)

    # Re-asignar IDs secuenciales
    for idx, p in enumerate(final_products):
        p["id"] = idx + 1

    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(final_products, f, ensure_ascii=False, indent=2)

    print("=" * 60)
    print("PROCESO FINALIZADO CON ÉXITO")
    print("=" * 60)
    print(f"Total de chats procesados:                {len(chat_files)}")
    print(f"Total de adjuntos leídos:                 {len(products)}")
    print(f"Productos únicos agrupados:               {len(final_products)}")
    print(f"Adjuntos sin descripción (omitidos):      {skipped_no_desc}")
    print(f"Overrides aplicados:                      {len(overrides)}")
    print(f"Archivo JSON guardado en:                 {output_json}")
    print("=" * 60)
    print("[OK] PASO SIGUIENTE: Ejecuta 'python rename_images.py'")
    print("=" * 60)


if __name__ == "__main__":
    parse_chat()

