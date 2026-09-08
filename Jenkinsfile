pipeline {
    agent any

    stages {

        stage('Tests') {
            steps {
                sh '''
                    docker run --rm \
                    -v "$WORKSPACE:/app" \
                    -w /app \
                    python:3.13-slim \
                    sh -c "pip install uv==0.12.5 && uv sync --locked && uv run pytest -v"
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    docker build -t clinica-veterinaria:latest .
                '''
            }
        }
    }
}