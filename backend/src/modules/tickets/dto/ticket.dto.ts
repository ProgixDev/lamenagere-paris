import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

const CATEGORIES = ['commande', 'livraison', 'produit', 'paiement', 'autre'];
const STATUSES = ['ouvert', 'en_cours', 'resolu', 'ferme'];
const PRIORITIES = ['basse', 'normale', 'haute', 'urgente'];

export class CreateTicketDto {
  @IsString() @MinLength(3) subject!: string;
  @IsEnum(CATEGORIES) category!: string;
  @IsString() @MinLength(5) description!: string;
  @IsOptional() @IsString() orderId?: string;
}

export class TicketMessageDtoIn {
  @IsString() @MinLength(1) content!: string;
}

export class UpdateTicketDto {
  @IsOptional() @IsEnum(STATUSES) status?: string;
  @IsOptional() @IsEnum(PRIORITIES) priority?: string;
}
