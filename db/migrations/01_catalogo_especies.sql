-- Compatible con bases existentes y nuevas. Se puede ejecutar varias veces.
BEGIN;

CREATE TABLE IF NOT EXISTS public.especie (
    id_especie BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    estado VARCHAR(15) NOT NULL DEFAULT 'ACTIVO'
        CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

INSERT INTO public.especie (nombre) VALUES
    ('Canino'), ('Felino'), ('Ave'), ('Roedor'), ('Reptil'), ('Otro')
ON CONFLICT (nombre) DO NOTHING;

GRANT SELECT ON public.especie TO petcore_app;

COMMIT;
