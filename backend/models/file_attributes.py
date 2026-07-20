import os
import subprocess
import platform
from pathlib import Path
from datetime import datetime
import time

# ==================== WINDOWS: Creation date ====================
if platform.system() == 'Windows':
    import ctypes
    from ctypes import wintypes

    class FILETIME(ctypes.Structure):
        _fields_ = [("dwLowDateTime", wintypes.DWORD),
                    ("dwHighDateTime", wintypes.DWORD)]

    def datetime_to_filetime(dt):
        epoch = datetime(1601, 1, 1)
        delta = dt - epoch
        microseconds = delta.total_seconds() * 1000000
        filetime = int(microseconds * 10)
        low = filetime & 0xFFFFFFFF
        high = (filetime >> 32) & 0xFFFFFFFF
        return FILETIME(low, high)

    def set_file_creation_time(filepath, dt):
        """Define data de criação de um arquivo no Windows (usa ctypes)."""
        handle = ctypes.windll.kernel32.CreateFileW(
            str(filepath),
            0x40000000,  # GENERIC_WRITE
            0,
            None,
            3,           # OPEN_EXISTING
            0x80,        # FILE_FLAG_BACKUP_SEMANTICS
            None
        )
        if handle == -1:
            raise ctypes.WinError()
        try:
            ft = datetime_to_filetime(dt)
            # Aplica a mesma data para criação, acesso e modificação
            result = ctypes.windll.kernel32.SetFileTime(handle, ctypes.byref(ft), ctypes.byref(ft), ctypes.byref(ft))
            if result == 0:
                raise ctypes.WinError()
        finally:
            ctypes.windll.kernel32.CloseHandle(handle)
else:
    def set_file_creation_time(filepath, dt):
        # Não suportado em Unix – ignora
        pass


# ==================== ATRIBUTOS (Windows: attrib) ====================
def set_readonly(filepath, readonly):
    if platform.system() == 'Windows':
        subprocess.run(["attrib", "+R" if readonly else "-R", str(filepath)],
                       check=True, capture_output=True)
    else:
        # Unix: remove/adiciona permissão de escrita para dono
        current = os.stat(filepath).st_mode
        if readonly:
            os.chmod(filepath, current & ~0o222)
        else:
            os.chmod(filepath, current | 0o222)

def set_hidden(filepath, hidden):
    if platform.system() == 'Windows':
        subprocess.run(["attrib", "+H" if hidden else "-H", str(filepath)],
                       check=True, capture_output=True)
    # Em Unix, ignoramos (não há atributo oculto padrão)

def set_system(filepath, system):
    if platform.system() == 'Windows':
        subprocess.run(["attrib", "+S" if system else "-S", str(filepath)],
                       check=True, capture_output=True)


# ==================== PERMISSÕES (Unix) ====================
def set_permissions(filepath, mode_octal):
    if platform.system() != 'Windows':
        try:
            os.chmod(filepath, int(mode_octal, 8))
        except:
            pass


# ==================== APLICA TODAS AS ALTERAÇÕES ====================
def apply_attributes(filepath, options):
    """
    Aplica todas as alterações definidas em options.
    options: dict com chaves:
        readonly: bool ou None
        hidden: bool ou None
        system: bool ou None
        modification_date: datetime ou None
        creation_date: datetime ou None
        permissions: str (ex: "755") ou None
    """
    if 'readonly' in options and options['readonly'] is not None:
        set_readonly(filepath, options['readonly'])
    if 'hidden' in options and options['hidden'] is not None:
        set_hidden(filepath, options['hidden'])
    if 'system' in options and options['system'] is not None:
        set_system(filepath, options['system'])
    if 'modification_date' in options and options['modification_date'] is not None:
        dt = options['modification_date']
        # Aplica mtime e atime
        if platform.system() == 'Windows':
            # No Windows, atime e mtime podem ser alterados com os.utime
            timestamp = dt.timestamp()
            os.utime(filepath, (timestamp, timestamp))
        else:
            timestamp = dt.timestamp()
            os.utime(filepath, (timestamp, timestamp))
    if 'creation_date' in options and options['creation_date'] is not None:
        if platform.system() == 'Windows':
            set_file_creation_time(filepath, options['creation_date'])
    if 'permissions' in options and options['permissions'] is not None:
        set_permissions(filepath, options['permissions'])