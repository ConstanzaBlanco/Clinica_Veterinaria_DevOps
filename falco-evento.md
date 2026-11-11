# Evento detectado por Falco

`/etc/shadow` es un archivo de acceso restringido de Linux que almacena los hashes de las contraseñas y datos de caducidad de las cuentas locales.

En el backend se ejecutó `ln -s /etc/shadow /tmp/falco-prueba`, que creó un enlace simbólico hacia un archivo sensible. Falco registró la alerta `Create Symlink Over Sensitive Files` con prioridad `Warning`. La prueba creó el enlace sin leer ni modificar `/etc/shadow`.
