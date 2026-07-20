import os
import re
from pathlib import Path
from datetime import datetime

# Imagens
try:
    from PIL import Image
    from PIL.ExifTags import TAGS
except ImportError:
    Image = None

# Áudio
try:
    import mutagen
    from mutagen import File
    from mutagen.mp3 import MP3
    from mutagen.flac import FLAC
    from mutagen.oggvorbis import OggVorbis
    from mutagen.easyid3 import EasyID3
except ImportError:
    mutagen = None

def get_image_metadata(file_path, use_mtime_fallback=True):
    """
    Extrai data EXIF de imagens JPEG/PNG/etc.
    Se não houver EXIF e use_mtime_fallback for True, usa a data de modificação.
    Retorna dict com 'datetime_original' (string) ou None.
    """
    if not Image:
        return None
    try:
        img = Image.open(file_path)
        exifdata = img._getexif()
        if exifdata:
            for tag_id, value in exifdata.items():
                tag = TAGS.get(tag_id, tag_id)
                if tag == 'DateTimeOriginal' or tag == 'DateTime':
                    return {'datetime_original': str(value)}
        # Fallback: data de modificação
        if use_mtime_fallback:
            mtime = os.path.getmtime(file_path)
            dt = datetime.fromtimestamp(mtime)
            return {'datetime_original': dt.strftime('%Y-%m-%d %H:%M:%S')}
        return None
    except Exception:
        # Fallback mesmo em erro
        if use_mtime_fallback:
            try:
                mtime = os.path.getmtime(file_path)
                dt = datetime.fromtimestamp(mtime)
                return {'datetime_original': dt.strftime('%Y-%m-%d %H:%M:%S')}
            except:
                pass
        return None

def get_audio_metadata(file_path):
    """
    Extrai tags ID3 de MP3, FLAC, OGG, etc.
    Retorna dict com 'artist', 'title' ou None.
    """
    if not mutagen:
        return None
    try:
        audio = mutagen.File(file_path)
        if audio is None:
            return None
        artist = None
        title = None
        if hasattr(audio, 'get'):
            artist = audio.get('artist', [None])[0] if 'artist' in audio else None
            title = audio.get('title', [None])[0] if 'title' in audio else None
        if not artist and hasattr(audio, 'tags'):
            if 'TPE1' in audio.tags:
                artist = str(audio.tags['TPE1'])
            if 'TIT2' in audio.tags:
                title = str(audio.tags['TIT2'])
        return {'artist': artist, 'title': title}
    except Exception:
        return None

def get_text_metadata(file_path, max_chars=50):
    """
    Extrai a primeira linha de um arquivo de texto.
    Retorna dict com 'first_line'.
    """
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            first_line = f.readline().strip()
            if len(first_line) > max_chars:
                first_line = first_line[:max_chars] + '...'
            return {'first_line': first_line}
    except Exception:
        return None

def generate_new_name(original_path, metadata, pattern='auto'):
    """
    Gera um novo nome baseado no metadata.
    pattern: 'auto' (decide automático), 'date', 'artist', 'line', etc.
    Retorna o novo nome (sem extensão) ou None se não houver metadados.
    """
    ext = Path(original_path).suffix
    stem = Path(original_path).stem

    if metadata is None:
        return None

    if pattern == 'auto':
        if 'datetime_original' in metadata:
            dt_str = metadata['datetime_original'].replace(':', '-').replace(' ', '_')
            return f"{dt_str}_{stem}"
        elif 'artist' in metadata and metadata['artist']:
            artist = re.sub(r'[^\w\s-]', '', metadata['artist'])[:30]
            title = re.sub(r'[^\w\s-]', '', metadata['title'])[:30] if metadata['title'] else ''
            return f"{artist}_{title}".replace(' ', '_')
        elif 'first_line' in metadata:
            line = re.sub(r'[^\w\s-]', '', metadata['first_line'])[:40]
            return line.replace(' ', '_')
        else:
            return None
    elif pattern == 'date':
        if 'datetime_original' in metadata:
            dt_str = metadata['datetime_original'].replace(':', '-').replace(' ', '_')
            return f"{dt_str}_{stem}"
        else:
            return None
    elif pattern == 'artist':
        if 'artist' in metadata and metadata['artist']:
            artist = re.sub(r'[^\w\s-]', '', metadata['artist'])[:30]
            title = re.sub(r'[^\w\s-]', '', metadata['title'])[:30] if metadata['title'] else ''
            return f"{artist}_{title}".replace(' ', '_')
        else:
            return None
    elif pattern == 'line':
        if 'first_line' in metadata:
            line = re.sub(r'[^\w\s-]', '', metadata['first_line'])[:40]
            return line.replace(' ', '_')
        else:
            return None
    else:
        return None