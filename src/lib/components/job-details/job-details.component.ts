import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";

import {
  JobDetailEntry,
  JobDetailsResponse,
} from "../../interfaces/job-detail.interface";

@Component({
  selector: "syr-job-details",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./job-details.component.html",
})
export class JobDetailsComponent implements OnInit {
  @Input() jobDetails: JobDetailsResponse | null = null;
  @Input() isLoading: boolean = false;
  @Output() refresh = new EventEmitter<void>();

  ngOnInit(): void {
    // Component initialization
  }

  onRefresh(): void {
    this.refresh.emit();
  }
}
