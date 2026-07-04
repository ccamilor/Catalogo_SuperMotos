import os
import re
import json
import sys
import unicodedata

script_dir = os.path.dirname(os.path.abspath(__file__))
images_dir = os.path.join(script_dir, "assets", "images")
output_json = os.path.join(script_dir, "catalogo.json")
relative_img_dir = "assets/images"

def slugify(text):
    # Reemplazar eñes y caracteres especiales comunes
    text = text.replace('ñ', 'n').replace('Ñ', 'n')
    # Normalizar unicode para separar los acentos de las letras (NFD)
    text = unicodedata.normalize('NFD', text)
    # Filtrar solo caracteres base (eliminar tildes/acentos combinados)
    text = "".join([c for c in text if not unicodedata.combining(c)])
    # Convertir a minúsculas
    text = text.lower()
    # Eliminar cualquier caracter que no sea letra, número o espacio/guión
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    # Reemplazar múltiples espacios o guiones por un solo guión
    text = re.sub(r'[\s-]+', '-', text).strip('-')
    # Limitar el tamaño a un máximo razonable para no tener nombres gigantes
    if len(text) > 40:
        text = text[:40].rstrip('-')
    # Si queda vacío tras el filtrado, usar un fallback
    if not text:
        text = "repuesto"
    return text

def rename_images():
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        print("=" * 60)
        print("MODO SIMULACIÓN (DRY RUN): NO SE REALIZARÁN CAMBIOS FÍSICOS")
        print("=" * 60)

    if not os.path.exists(output_json):
        print(f"Error: No se encontró catalogo.json en {output_json}")
        return

    with open(output_json, "r", encoding="utf-8") as f:
        products = json.load(f)

    # Mantener registro de nombres físicos ya ocupados en assets/images/
    # o asignados durante esta ejecución para evitar colisiones
    all_files_in_dir = os.listdir(images_dir) if os.path.exists(images_dir) else []
    occupied_names = set(all_files_in_dir)

    renamed_count = 0
    skipped_count = 0
    error_count = 0

    # Patrón para identificar imágenes con nombres crudos de WhatsApp (ej: IMG-20260615-WA0002.jpg)
    whatsapp_img_pattern = re.compile(r"^IMG-\d{8}-WA\d{4}\.(jpg|jpeg|png)$", re.IGNORECASE)

    for p in products:
        desc = p.get("description", "").strip()
        filenames = p.get("filenames", [])
        images = p.get("images", [])
        
        # Inicializar original_filenames si no existiera
        if "original_filenames" not in p:
            p["original_filenames"] = list(filenames)

        # Generar base del slug para este producto
        base_slug = slugify(desc)

        new_filenames = []
        new_images = []

        for idx, current_fn in enumerate(filenames):
            # Comprobar si el archivo es un PDF (los dejamos quietos)
            if current_fn.lower().endswith(".pdf"):
                new_filenames.append(current_fn)
                new_images.append(images[idx])
                continue

            # Si el archivo NO tiene patrón de WhatsApp, significa que ya está renombrado
            if not whatsapp_img_pattern.match(current_fn):
                new_filenames.append(current_fn)
                new_images.append(images[idx])
                skipped_count += 1
                # Asegurar de que esté en occupied_names para evitar que otros lo colisionen
                occupied_names.add(current_fn)
                continue

            # Buscar un nombre único disponible
            ext = os.path.splitext(current_fn)[1].lower()
            counter = 1
            proposed_name = f"{base_slug}-{counter}{ext}"

            # Si el archivo propuesto ya existe o está reservado, subimos el contador
            while proposed_name in occupied_names:
                counter += 1
                proposed_name = f"{base_slug}-{counter}{ext}"

            # Reservar nombre
            occupied_names.add(proposed_name)

            # Rutas de origen y destino
            src_path = os.path.join(images_dir, current_fn)
            dest_path = os.path.join(images_dir, proposed_name)

            if os.path.exists(src_path):
                if dry_run:
                    print(f"[SIMULACIÓN] Renombrar: {current_fn}  -->  {proposed_name}")
                    renamed_count += 1
                else:
                    try:
                        os.rename(src_path, dest_path)
                        print(f"Éxito: {current_fn}  -->  {proposed_name}")
                        renamed_count += 1
                    except Exception as e:
                        print(f"Error al renombrar {current_fn}: {e}")
                        error_count += 1
                        proposed_name = current_fn # mantener el actual en caso de fallo
                
                new_filenames.append(proposed_name)
                new_images.append(f"{relative_img_dir}/{proposed_name}")
            else:
                # El archivo de origen no existe físicamente en assets/images/
                print(f"Advertencia: El archivo {current_fn} no existe físicamente en {images_dir}")
                new_filenames.append(current_fn)
                new_images.append(images[idx])
                error_count += 1

        # Actualizar datos del producto
        p["filenames"] = new_filenames
        p["images"] = new_images

    # Guardar los cambios de catalogo.json si no es un dry-run
    if not dry_run:
        try:
            with open(output_json, "w", encoding="utf-8") as f:
                json.dump(products, f, ensure_ascii=False, indent=2)
            print("\n[OK] Archivo catalogo.json actualizado correctamente.")
        except Exception as e:
            print(f"\n[ERROR] Error al guardar catalogo.json: {e}")
            error_count += 1

    print("=" * 60)
    print("RESUMEN DE MIGRACIÓN DE IMÁGENES")
    print("=" * 60)
    print(f"Archivos renombrados con éxito:         {renamed_count}")
    print(f"Archivos ya limpios (saltados):         {skipped_count}")
    print(f"Errores / No encontrados:               {error_count}")
    print("=" * 60)
    if dry_run:
        print("[OK] Todo listo. Ejecuta sin '--dry-run' para aplicar los cambios físicos.")
        print("=" * 60)

if __name__ == "__main__":
    rename_images()
