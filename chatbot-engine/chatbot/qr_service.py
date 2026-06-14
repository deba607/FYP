import base64
from io import BytesIO


class QRService:
    def generate_data_url(self, value: str) -> str:
        if not value:
            raise ValueError("QR value is required")

        import qrcode

        image = qrcode.make(value)
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{encoded}"
