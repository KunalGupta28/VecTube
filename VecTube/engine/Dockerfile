FROM python:3.10-bookworm

SHELL [ "/bin/bash", "-c" ]

ENV SHELL=/bin/bash
ENV POETRY_HOME=/etc/poetry
ENV PATH="$POETRY_HOME/venv/bin:$PATH"
ENV VT_APP_DIR=/var/vectube
RUN apt update && apt upgrade -y
RUN apt install g++ gcc cmake ffmpeg curl libssl-dev bash -y
RUN apt install python3-pip pipx -y
RUN apt autoremove -y
RUN apt autoclean -y

#INSTALL POETRY
RUN curl -sSL https://install.python-poetry.org | POETRY_HOME=/etc/poetry python3 -

WORKDIR /usr/src/engine
COPY engine engine
COPY pyproject.toml poetry.lock* README.md /
RUN poetry config virtualenvs.in-project true
RUN poetry env use $(which python3)
RUN poetry config installer.max-workers 2
RUN --mount=type=cache,target=/root/.cache/pypoetry \
    --mount=type=cache,target=/root/.cache/pip \
    poetry install

VOLUME [ "/var/vectube" ]
EXPOSE 8000
CMD ["poetry", "run", "python", "engine/server.py"]