import os
import sys
import json
import shutil
import subprocess

# ==============================================================================
# CONFIGURACIÓN DEL PROCESAMIENTO
# ==============================================================================
# Si es True, rellena el fondo removido con color blanco sólido.
# Si es False, deja el fondo transparente (requiere guardar como PNG).
FONDO_BLANCO = True  # Cambia a False si prefieres fondo transparente

# Formato de salida: 'png' o 'jpg'
# Si FONDO_BLANCO es True, se recomienda 'jpg' para ahorrar espacio y mantener nombres originales.
# Si FONDO_BLANCO es False, DEBE ser 'png' para poder soportar transparencia.
FORMATO_SALIDA = 'jpg'  # 'png' o 'jpg'
# ==============================================================================

# Validar configuración
FORMATO_SALIDA = FORMATO_SALIDA.lower()
if not FONDO_BLANCO and FORMATO_SALIDA in ('jpg', 'jpeg'):
    print("ADVERTENCIA: No se puede guardar como JPG con fondo transparente. Cambiando FORMATO_SALIDA a 'png'.")
    FORMATO_SALIDA = 'png'

# Directorio del script (Antigravity_prueba1)
script_dir = os.path.dirname(os.path.abspath(__file__))
images_dir = os.path.join(script_dir, "assets", "images")
backup_dir = os.path.join(script_dir, "assets", "images_originales_backup")
json_path = os.path.join(script_dir, "catalogo.json")

# Intentar importar rembg y tqdm, si no están, intentar instalarlos automáticamente
try:
    from rembg import remove, new_session
    from PIL import Image
    from tqdm import tqdm
except ImportError:
    print("No se encontraron las librerías necesarias. Instalándolas automáticamente...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "rembg[cpu]", "pillow", "tqdm"])
        from rembg import remove, new_session
        from PIL import Image
        from tqdm import tqdm
        print("Librerías instaladas con éxito.\n")
    except Exception as e:
        print(f"Error al instalar librerías: {e}")
        print("Por favor ejecuta manualmente: pip install rembg[cpu] pillow tqdm")
        sys.exit(1)

def main():
    if not os.path.exists(images_dir):
        print(f"Error: No se encontró la carpeta de imágenes en: {images_dir}")
        return

    # Crear carpeta de backup para no perder los archivos originales
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
        print(f"Creada carpeta de respaldo en: {backup_dir}")

    # Obtener todas las imágenes JPG/JPEG/PNG en el directorio original
    valid_input_extensions = (".jpg", ".jpeg", ".JPG", ".JPEG", ".png", ".PNG")
    image_files = [f for f in os.listdir(images_dir) if f.endswith(valid_input_extensions)]

    # Filtrar archivos para procesar (omitir PDFs)
    to_process = [f for f in image_files if not f.lower().endswith(".pdf")]

    if not to_process:
        print("No se encontraron imágenes para procesar en la carpeta.")
        return

    print(f"Se encontraron {len(to_process)} imágenes para procesar.")
    print(f"Configuración activa: Fondo Blanco = {FONDO_BLANCO} | Formato de Salida = {FORMATO_SALIDA.upper()}")
    print("Iniciando procesamiento de fondo. Esto tomará algún tiempo ya que utiliza un modelo de Inteligencia Artificial local...")
    print("Nota: El primer elemento puede tardar un poco más mientras se descarga el modelo de IA (ISNet) si no está en caché.\n")

    processed_count = 0
    error_count = 0

    # Inicializar la sesión de rembg con el modelo de alta precisión
    try:
        session = new_session("isnet-general-use")
    except Exception as e:
        print(f"Error al inicializar el modelo de IA: {e}")
        return

    # Procesar imágenes con barra de progreso
    for filename in tqdm(to_process, desc="Procesando imágenes"):
        input_path = os.path.join(images_dir, filename)
        
        # Generar nombre del archivo de salida
        base_name, ext = os.path.splitext(filename)
        output_filename = base_name + f".{FORMATO_SALIDA}"
        output_path = os.path.join(images_dir, output_filename)

        try:
            # 1. Abrir imagen de entrada y cargar sus datos en memoria
            with Image.open(input_path) as img:
                img.load()
            
            # 2. Quitar fondo (retorna una imagen RGBA con transparencia sin suavizado - Variación 2)
            rgba_img = remove(img, session=session, alpha_matting=False)
            
            # 3. Mover el archivo original a la carpeta de backup
            backup_path = os.path.join(backup_dir, filename)
            if os.path.exists(backup_path):
                shutil.move(input_path, os.path.join(backup_dir, f"dup_{filename}"))
            else:
                shutil.move(input_path, backup_path)
            
            # 4. Aplicar fondo blanco si está activo
            if FONDO_BLANCO:
                # Crear fondo blanco sólido del mismo tamaño
                white_bg = Image.new("RGBA", rgba_img.size, (255, 255, 255, 255))
                # Pegar la imagen recortada encima usando su propio canal alfa
                final_img = Image.alpha_composite(white_bg, rgba_img)
                
                # Guardar en el formato destino
                if FORMATO_SALIDA in ('jpg', 'jpeg'):
                    final_img = final_img.convert("RGB")
                    final_img.save(output_path, "JPEG", quality=90)
                else:
                    final_img.save(output_path, "PNG")
            else:
                # Guardar transparente (formato PNG)
                rgba_img.save(output_path, "PNG")
            
            processed_count += 1
        except Exception as e:
            print(f"\nError al procesar {filename}: {e}")
            error_count += 1

    print(f"\nProceso de imágenes finalizado.")
    print(f"Imágenes procesadas exitosamente: {processed_count}")
    print(f"Errores: {error_count}")

    # Actualizar catalogo.json
    if os.path.exists(json_path):
        print(f"Actualizando {json_path}...")
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                catalog_data = json.load(f)

            updated = False
            target_ext = f".{FORMATO_SALIDA}"
            
            for item in catalog_data:
                # Actualizar lista de rutas de imágenes
                if "images" in item:
                    new_images = []
                    for img_path in item["images"]:
                        base, ext = os.path.splitext(img_path)
                        if ext.lower() != target_ext:
                            new_images.append(base + target_ext)
                            updated = True
                        else:
                            new_images.append(img_path)
                    item["images"] = new_images

                # Actualizar lista de nombres de archivos
                if "filenames" in item:
                    new_filenames = []
                    for fn in item["filenames"]:
                        base, ext = os.path.splitext(fn)
                        if ext.lower() != target_ext:
                            new_filenames.append(base + target_ext)
                            updated = True
                        else:
                            new_filenames.append(fn)
                    item["filenames"] = new_filenames

            if updated:
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(catalog_data, f, ensure_ascii=False, indent=2)
                print(f"[OK] catalogo.json actualizado con las extensiones {target_ext}")
            else:
                print("No fue necesario actualizar catalogo.json (las referencias ya están correctas).")
        except Exception as e:
            print(f"Error al actualizar catalogo.json: {e}")

if __name__ == "__main__":
    main()
