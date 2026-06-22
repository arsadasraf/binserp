    ```
2.  Activate the virtual environment:
    - Windows: `venv\Scripts\activate`
    - Unix: `source venv/bin/activate`
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## Running the Server

```bash
uvicorn main:app --reload --port 8001
```
The server will run on `http://localhost:8001`.
