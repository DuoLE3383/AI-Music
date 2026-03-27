FROM python:3.9-slim

WORKDIR /backend
RUN apt-get update && apt-get install -y libasound2-dev libjack-dev libsndfile1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]