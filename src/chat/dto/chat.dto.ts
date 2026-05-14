import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatRequestDto {
  @ApiProperty({
    description: 'Mensaje del usuario en lenguaje natural',
    example: '¿Cuántos clientes activos tenemos?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'ID de conversación para mantener contexto (opcional)',
    required: false,
    example: 'conv-uuid-1234',
  })
  @IsString()
  @IsOptional()
  conversationId?: string;
}
