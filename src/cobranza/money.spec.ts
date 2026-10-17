import { cents, desglosarIva, desgloseDeContrato } from "./money";

describe("desglose de IVA", () => {
  it("estima desde el total al 16 % y cuadra al centavo", () => {
    const d = desglosarIva(cents("3487.04"));
    expect(d.subtotal + d.iva).toBe(348704);
  });

  it("usa el subtotal y el IVA del contrato cuando el total coincide y el contrato cuadra", () => {
    const contrato = { total: "3377.76", subtotal: "2911.87", iva: "465.89" };
    expect(desglosarIva(cents("3377.76"))).toEqual({ subtotal: 291186, iva: 46590 });
    expect(desgloseDeContrato(cents("3377.76"), contrato)).toEqual({ subtotal: 291187, iva: 46589 });
  });

  it("no usa un contrato que no cuadra (caso real: 2911.87 + 465.90 = 3377.77 con total 3377.76)", () => {
    expect(desgloseDeContrato(cents("3377.76"), { total: "3377.76", subtotal: "2911.87", iva: "465.90" })).toBeNull();
  });

  it("no aplica si el total es distinto al del contrato, si el contrato no cuadra o le faltan montos", () => {
    expect(desgloseDeContrato(cents("3600.00"), { total: "3487.04", subtotal: "3006.07", iva: "480.97" })).toBeNull();
    expect(desgloseDeContrato(cents("3487.04"), { total: "3487.04", subtotal: "3006.00", iva: "480.97" })).toBeNull();
    expect(desgloseDeContrato(cents("3487.04"), { total: "3487.04", subtotal: null, iva: "480.97" })).toBeNull();
    expect(desgloseDeContrato(0, { total: "0.00", subtotal: "0.00", iva: "0.00" })).toBeNull();
    expect(desgloseDeContrato(cents("100.00"), null)).toBeNull();
  });
});
