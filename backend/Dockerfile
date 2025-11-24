FROM python:3.11-slim
WORKDIR /backend

ENV PYTHONUNBUFFERED=1

RUN apt-get update 

COPY requirements.txt .

RUN pip install --upgrade pip setuptools wheel
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "server.py"]
