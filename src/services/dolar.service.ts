export const getDolar = async () => {
	try {
		const response = await fetch('https://dolarapi.com/v1/dolares/oficial');

		if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

		const data: any = await response.json();
		const { compra, venta } = data;
		return { compra, venta };
	} catch (error) {
		throw new Error('Error trayendo los valores del dolar');
	}
};
