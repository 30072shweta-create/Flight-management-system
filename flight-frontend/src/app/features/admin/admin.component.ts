import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FlightsService } from '../../core/services/flights.service';
import { AirportsService } from '../../core/services/airports.service';
import { AirlinesService } from '../../core/services/airlines.service';
import { AircraftService } from '../../core/services/aircraft.service';
import { BookingsService } from '../../core/services/bookings.service';
import { PaymentsService } from '../../core/services/payments.service';
import { AuthService } from '../../core/auth/auth.service';
import { FlightResponseDTO } from '../../core/models/flight.model';
import { BookingResponseDTO } from '../../core/models/booking.model';
import { PaymentResponseDTO } from '../../core/models/payment.model';
import { AdminSidebarComponent } from './components/admin-sidebar/admin-sidebar.component';

export interface BookingTrendPoint {
  date: string;
  dayLabel: string;
  bookings: number;
}

export interface PopularRoute {
  route: string;
  origin: string;
  destination: string;
  volume: number;
  revenue: string;
  loadFactor: string;
  percentage: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, AdminSidebarComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  public authService = inject(AuthService);
  private flightsService = inject(FlightsService);
  private airportsService = inject(AirportsService);
  private airlinesService = inject(AirlinesService);
  private aircraftService = inject(AircraftService);
  private bookingsService = inject(BookingsService);
  private paymentsService = inject(PaymentsService);

  public isLoading = false;
  public errorMessage = '';

  public flights: FlightResponseDTO[] = [];
  public airportsCount = 0;
  public airlinesCount = 0;
  public aircraftCount = 0;
  public bookings: BookingResponseDTO[] = [];
  public payments: PaymentResponseDTO[] = [];

  // Data Visualizations State
  public hoveredTrendPoint: BookingTrendPoint | null = null;
  public monthlyRevenueTarget = 1500000;
  public bookingTrends: BookingTrendPoint[] = [];

  public ngOnInit(): void {
    this.loadDashboardData();
  }

  public loadDashboardData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.flightsService.getAllFlights().subscribe({
      next: (data) => {
        this.flights = data || [];
        this.isLoading = false;
      },
      error: (err) => {
        this.handleError(err);
        this.isLoading = false;
      }
    });

    this.airportsService.getAllAirports().subscribe({
      next: (data) => (this.airportsCount = (data || []).length),
      error: (err) => console.warn('Airports load error', err)
    });

    this.airlinesService.getAllAirlines().subscribe({
      next: (data) => (this.airlinesCount = (data || []).length),
      error: (err) => console.warn('Airlines load error', err)
    });

    this.aircraftService.getAllAircraft().subscribe({
      next: (data) => (this.aircraftCount = (data || []).length),
      error: (err) => console.warn('Aircraft load error', err)
    });

    this.bookingsService.getAllBookings().subscribe({
      next: (data) => {
        this.bookings = (data || []).sort((a, b) => {
          const tA = a.bookingTs ? new Date(a.bookingTs).getTime() : a.bookingId;
          const tB = b.bookingTs ? new Date(b.bookingTs).getTime() : b.bookingId;
          return tB - tA;
        });
        if (this.bookings.length > 0) {
          this.processBookingTrends(this.bookings);
        }
      },
      error: (err) => console.warn('Bookings load error', err)
    });

    this.paymentsService.getAllPayments().subscribe({
      next: (data) => (this.payments = data || []),
      error: (err) => console.warn('Payments load error', err)
    });
  }

  public get totalFlightsCount(): number {
    return this.flights.length;
  }

  public get activeFlightsCount(): number {
    return this.flights.filter(
      (f) => f.status === 'SCHEDULED' || f.status === 'BOARDING' || f.status === 'DEPARTED'
    ).length;
  }

  public get totalBookingsCount(): number {
    return this.bookings.length;
  }

  public get totalRevenue(): number {
    const fromPayments = this.payments
      .filter((p) => {
        const s = (p.status || '').toUpperCase();
        return s === 'PAID' || s === 'SUCCESS' || s === 'COMPLETED';
      })
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    if (fromPayments > 0) {
      return fromPayments;
    }

    return this.bookings
      .filter((b) => {
        const s = (b.paymentStatus || b.status || '').toUpperCase();
        return s === 'PAID' || s === 'SUCCESS' || s === 'CONFIRMED';
      })
      .reduce((acc, b) => acc + (Number(b.totalAmount) || 0), 0);
  }

  public get monthlyProgressPercent(): number {
    return this.totalRevenue > 0
      ? Math.min(100, Math.round((this.totalRevenue / this.monthlyRevenueTarget) * 100 * 10) / 10)
      : 0;
  }

  public get peakBookingsPerDay(): number {
    if (this.bookingTrends.length === 0) return 0;
    return Math.max(...this.bookingTrends.map(p => p.bookings));
  }

  public get popularRoutes(): PopularRoute[] {
    const routeCounts = new Map<string, { count: number; origin: string; dest: string }>();

    // Check actual booking segments first
    if (this.bookings && this.bookings.length > 0) {
      for (const b of this.bookings) {
        if (b.segments && b.segments.length > 0) {
          for (const s of b.segments) {
            if (s.fromAirport && s.toAirport) {
              const key = `${s.fromAirport} - ${s.toAirport}`;
              const curr = routeCounts.get(key) || { count: 0, origin: s.fromAirport, dest: s.toAirport };
              curr.count++;
              routeCounts.set(key, curr);
            }
          }
        }
      }
    }

    // Fallback to registered flight routes if bookings don't have segments populated
    if (routeCounts.size === 0 && this.flights.length > 0) {
      for (const f of this.flights) {
        const key = `${f.fromAirport} - ${f.toAirport}`;
        const current = routeCounts.get(key) || { count: 0, origin: f.fromAirport, dest: f.toAirport };
        current.count++;
        routeCounts.set(key, current);
      }
    }

    const sorted = Array.from(routeCounts.values()).sort((a, b) => b.count - a.count).slice(0, 4);
    if (sorted.length === 0) {
      return [];
    }
    const maxCount = Math.max(...sorted.map(s => s.count), 1);
    return sorted.map((s) => {
      const loadPct = Math.min(96, Math.round((s.count / maxCount) * 90) + 6);
      return {
        route: `${s.origin} to ${s.dest}`,
        origin: s.origin,
        destination: s.dest,
        volume: s.count,
        revenue: `₹${(s.count * 7500).toLocaleString('en-IN')}`,
        loadFactor: `${loadPct}%`,
        percentage: Math.round((s.count / maxCount) * 100)
      };
    });
  }

  // SVG Line Chart coordinates calculation for 30 days
  public get chartCoordinates() {
    const points = this.bookingTrends;
    if (!points || points.length === 0) {
      return { path: '', areaPath: '', points: [], minVal: 0, maxVal: 20, yAxisLabels: [20, 13, 7] };
    }

    const svgWidth = 620;
    const svgHeight = 190;
    const paddingX = 25;
    const paddingY = 25;
    const width = svgWidth - paddingX * 2;
    const height = svgHeight - paddingY * 2;

    const values = points.map((p) => p.bookings);
    const maxBookings = Math.max(...values, 0);
    const maxVal = Math.max(maxBookings + Math.max(1, Math.ceil(maxBookings * 0.2)), 5);
    const minVal = 0;
    const range = maxVal - minVal || 1;

    const coords = points.map((p, index) => {
      const x = paddingX + (index / (points.length - 1)) * width;
      const normalized = (p.bookings - minVal) / range;
      const y = svgHeight - paddingY - normalized * height;
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, data: p };
    });

    const pathD = coords.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');

    const first = coords[0];
    const last = coords[coords.length - 1];
    const areaD = `${pathD} L ${last.x} ${svgHeight - paddingY} L ${first.x} ${svgHeight - paddingY} Z`;

    const yAxisLabels = [
      Math.round(maxVal * 0.95),
      Math.round(maxVal * 0.65),
      Math.round(maxVal * 0.35)
    ];

    return {
      path: pathD,
      areaPath: areaD,
      points: coords,
      minVal,
      maxVal,
      yAxisLabels
    };
  }

  public get recentBookings(): BookingResponseDTO[] {
    return this.bookings.slice(0, 5);
  }

  public getPassengerName(b: BookingResponseDTO): string {
    if (b.passengers && b.passengers.length > 0) {
      const p = b.passengers[0];
      const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim();
      if (fullName) {
        return fullName;
      }
    }
    return `User #${b.userId}`;
  }

  public getPassengerInfo(b: BookingResponseDTO): string {
    const parts: string[] = [];
    if (b.passengers && b.passengers.length > 0) {
      const p = b.passengers[0];
      if (p.seatNumber) {
        parts.push(`Seat ${p.seatNumber}`);
      }
      if (b.passengers.length > 1) {
        parts.push(`+${b.passengers.length - 1} more`);
      }
    } else {
      parts.push(`User #${b.userId}`);
    }
    return parts.join(' · ');
  }

  private processBookingTrends(bookings: BookingResponseDTO[]): void {
    const countsByDate = new Map<string, number>();
    for (const b of bookings) {
      if (b.bookingTs) {
        const dateKey = b.bookingTs.slice(0, 10);
        countsByDate.set(dateKey, (countsByDate.get(dateKey) || 0) + 1);
      }
    }

    let endDate = new Date();
    const sortedKeys = Array.from(countsByDate.keys()).sort();
    if (sortedKeys.length > 0) {
      const latestBookingDate = new Date(sortedKeys[sortedKeys.length - 1] + 'T00:00:00');
      if (latestBookingDate > endDate) {
        endDate = latestBookingDate;
      }
    }

    const points: BookingTrendPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const count = countsByDate.get(dateKey) || 0;
      points.push({
        date: dateKey,
        dayLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        bookings: count
      });
    }

    this.bookingTrends = points;
  }

  private handleError(err: any): void {
    this.isLoading = false;
    if (err.status === 403) {
      this.errorMessage = 'You do not have permission to access the admin dashboard.';
    } else if (err.status === 0) {
      console.warn('Backend server offline. Displaying local telemetry preview.');
    } else {
      this.errorMessage = err.error?.message || err.error || 'Failed to load dashboard data.';
    }
  }
}
