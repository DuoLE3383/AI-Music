import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000/api",
});

export const generateMusic = (payload, onProgress, signal) =>
  API.post("/generate", payload, {
    responseType: "blob",
    signal,
    onDownloadProgress: onProgress,
  });

export const remixMusic = (formData, params, onProgress, signal) =>
  API.post(`/remix`, formData, {
    params,
    responseType: "blob",
    signal,
    onUploadProgress: onProgress,
  });
