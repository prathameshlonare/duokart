/**
 * DuoKart Production Showcase Interactions
 * Pure vanilla JavaScript - Zero external dependencies
 */

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. Subsystem Specifications Data & Verified Console Evidence
  // -------------------------------------------------------------------------
  const subsystemData = {
    compute: {
      title: "Edge Ingress & Private Compute Tier",
      desc: "Declared in <code>infra/01-vpc.yaml</code> and <code>infra/02-compute.yaml</code>. Traffic enters an internet-facing Application Load Balancer across two Availability Zones and proxies to private EC2 instances managed by an Auto Scaling Group.",
      specs: [
        { k: "Load Balancer", v: "Internet-Facing ALB (port 80)" },
        { k: "Compute Instances", v: "EC2 t3.micro (Ubuntu 24.04)" },
        { k: "Auto Scaling Bounds", v: "Min: 2, Max: 4, Desired: 2" },
        { k: "Health Check Path", v: "HTTP :5000/health (15s interval)" },
        { k: "Public Exposure", v: "Zero public IPs on compute boxes" },
        { k: "SSH Admin Access", v: "Bastion jump host + SSM Session Mgr" }
      ],
      evidence: {
        title: "Target Group Health & Chaos Recovery",
        text: "ALB Target Group verified 2 healthy EC2 targets across AZ-2a and AZ-2b. Live termination drill proved automated replacement in 4 minutes with 100% client uptime.",
        thumb: "./assets/screenshots/target-healthy.png",
        modalTrigger: "compute-evidence"
      }
    },
    data: {
      title: "Relational Persistence & Parameter Store",
      desc: "Declared in <code>infra/03-data.yaml</code>. Stores product catalog, registered shop users, and relational order records. High availability is achieved via RDS MySQL 8.0 Multi-AZ synchronous standby.",
      specs: [
        { k: "Database Engine", v: "RDS MySQL 8.0 (Multi-AZ)" },
        { k: "Instance Size", v: "db.t3.micro (gp2 storage)" },
        { k: "Replication", v: "Synchronous to AZ-2b Standby" },
        { k: "Inbound Rule", v: "Port 3306 from app-sg only" },
        { k: "Storage Autoscale", v: "Up to 50 GB (alert < 5 GB)" },
        { k: "Credential Source", v: "SSM Parameter Store (/duokart/dev/db-*)" }
      ],
      evidence: {
        title: "RDS Multi-AZ & SSM Parameter Store",
        text: "Multi-AZ synchronous standby confirmed in AZ-2b. Database credentials securely loaded via SSM Parameter Store. (CloudFormation AWS::SSM::Parameter constraint resolved by restricting IAM access to String parameter).",
        thumb: "./assets/screenshots/rds-details.png",
        modalTrigger: "data-evidence"
      }
    },
    async: {
      title: "Asynchronous Queue, Lambda Worker & DynamoDB",
      desc: "Declared in <code>infra/05-queue.yaml</code>. Decouples fast order ingestion from downstream processing. Orders are queued in SQS, processed in batch size 1 by Python 3.12 Lambda, and written to DynamoDB with conditional transitions.",
      specs: [
        { k: "Ingestion Queue", v: "SQS Standard (high throughput)" },
        { k: "Dead-Letter Threshold", v: "DLQ after 3 failed receives" },
        { k: "Compute Worker", v: "AWS Lambda (Python 3.12, 128 MB)" },
        { k: "Status Table", v: "DynamoDB 'duokart-orders' (PK: orderId)" },
        { k: "State Guard", v: "Conditional write (RECEIVED -> PACKING)" },
        { k: "Notification Split", v: "SNS Buyer Topic vs Owner Topic" }
      ],
      evidence: {
        title: "SQS Queue, Lambda & DynamoDB Proofs",
        text: "SQS ingestion decoupled from database writes. Lambda worker executes Python 3.12 logic and writes to DynamoDB with conditional status guards, verified via live REST test and Gmail delivery.",
        thumb: "./assets/screenshots/sqs-queue.png",
        modalTrigger: "async-evidence"
      }
    },
    storage: {
      title: "S3 Object Storage & Direct Presigned PUTs",
      desc: "Declared in <code>infra/04-storage.yaml</code>. Photos and invoice bills are uploaded directly from the browser to Amazon S3 via cryptographically signed presigned URLs, keeping file bytes off the Flask compute tier.",
      specs: [
        { k: "S3 Photos Bucket", v: "duokart-photos (versioned, private)" },
        { k: "S3 Bills Bucket", v: "duokart-bills (versioned, lifecycle 30d)" },
        { k: "Upload Strategy", v: "Presigned PUT with SHA-256 checksum" },
        { k: "Compute Decoupling", v: "Flask app never proxies binary files" },
        { k: "Public Access Block", v: "All 4 BlockPublicAcls rules true" },
        { k: "Lifecycle Policy", v: "Transition to Glacier / 30-day expire" }
      ],
      evidence: {
        title: "S3 Presigned PUTs & Public Block",
        text: "Direct client-to-S3 uploads bypass Flask application servers. Configured with SHA-256 checksums, versioning, 30-day lifecycle expiration, and all 4 Public Access Blocks active.",
        thumb: "./assets/screenshots/s3-presigned-url.png",
        modalTrigger: "storage-evidence"
      }
    },
    ops: {
      title: "Observability, Telemetry & Budget Governance",
      desc: "Declared in <code>infra/06-observe.yaml</code>. Centralized CloudWatch dashboard monitoring requests, host health, database storage, and queue depth, backed by an automated $20 monthly budget ceiling.",
      specs: [
        { k: "Metric Alarms", v: "8 CloudWatch alarms to single SNS topic" },
        { k: "Host Alarm", v: "alb-unhealthy > 0 for 2 consecutive min" },
        { k: "Dead-Letter Alarm", v: "dlq-depth >= 1 (immediate page)" },
        { k: "Audit Logging", v: "CloudTrail active logging to S3 bucket" },
        { k: "Monthly Budget", v: "$20.00 cap (alerts at 60% and 100%)" },
        { k: "Teardown Order", v: "02-compute -> 05-queue -> 03-data -> 01-vpc" }
      ],
      evidence: {
        title: "CloudWatch Control Room & 8 Alarms",
        text: "Centralized dashboard for real-time telemetry, 8 metric alarms wired to SNS alerting, and an automated $20 monthly budget ceiling.",
        thumb: "./assets/screenshots/dashboard.png",
        modalTrigger: "ops-evidence"
      }
    }
  };

  // -------------------------------------------------------------------------
  // 2. Render Subsystem Details
  // -------------------------------------------------------------------------
  function renderSubsystem(subKey) {
    var sub = subsystemData[subKey];
    if (!sub) return;
    var container = document.getElementById("sub-display-content");
    if (!container) return;

    var html = '<div class="sub-card">';
    html += '<div class="sub-grid">';
    
    // Left column: Description & specs
    html += '<div class="sub-col">';
    html += '<h4>' + sub.title + '</h4>';
    html += '<p>' + sub.desc + '</p>';
    html += '<div class="spec-list">';
    sub.specs.forEach(function (spec) {
      html += '<div class="spec-box">';
      html += '<span class="spec-k">' + spec.k + '</span>';
      html += '<span class="spec-v">' + spec.v + '</span>';
      html += '</div>';
    });
    html += '</div></div>';

    // Right column: Evidence callout with interactive image thumbnail
    html += '<div class="sub-col">';
    html += '<div class="sub-evidence">';
    html += '<div class="sub-evidence-badge">Verified AWS Console Evidence</div>';
    html += '<h5>' + sub.evidence.title + '</h5>';
    html += '<p>' + sub.evidence.text + '</p>';
    
    if (sub.evidence.thumb) {
      html += '<div class="sub-evidence-thumb" data-evidence="' + sub.evidence.modalTrigger + '" title="Click to inspect AWS Console receipts">';
      html += '<img src="' + sub.evidence.thumb + '" alt="' + sub.evidence.title + '" loading="lazy">';
      html += '<div class="thumb-overlay"><span>Inspect Console Receipts &rarr;</span></div>';
      html += '</div>';
    }
    
    html += '<button type="button" class="btn-evidence-modal" data-evidence="' + sub.evidence.modalTrigger + '">View Supporting Console Receipts &rarr;</button>';
    html += '</div></div>';

    html += '</div></div>';
    container.innerHTML = html;

    // Attach click handlers for thumbnail and button
    var triggers = container.querySelectorAll("[data-evidence]");
    triggers.forEach(function (el) {
      el.addEventListener("click", function () {
        openEvidenceModal(el.getAttribute("data-evidence"));
      });
    });
  }

  // -------------------------------------------------------------------------
  // 3. Modal / Lightbox Dialog Handler
  // -------------------------------------------------------------------------
  var modal = document.getElementById("image-modal");
  var modalBody = document.getElementById("modal-body-content");
  var modalClose = document.getElementById("modal-close-btn");

  function openEvidenceModal(triggerKey) {
    if (!modal || !modalBody) return;
    var content = "";

    switch (triggerKey) {
      case "compute-evidence":
      case "self-heal":
        content = '<h3 class="modal-title">Edge Ingress &amp; Auto Scaling Compute Verification</h3>';
        content += '<img src="./assets/screenshots/target-healthy.png" alt="ALB Target Group Health in AWS Console">';
        content += '<p class="modal-caption"><strong>Target Group Health:</strong> ALB Target Group in us-east-2 registering 2 healthy EC2 instances (Ubuntu 24.04, port 5000) distributed across us-east-2a and us-east-2b.</p>';
        content += '<img src="./assets/screenshots/self-heal.png" alt="EC2 Instance termination in progress" style="margin-top:20px;">';
        content += '<p class="modal-caption"><strong>Step 1: Chaos Drill:</strong> EC2 instance <code>i-0c7ae07e6bc514239</code> in us-east-2a is manually terminated. Target Group health check triggers connection draining while the sibling instance serves all traffic.</p>';
        content += '<img src="./assets/screenshots/self-heal-replace.png" alt="ASG activity history showing new instance launch" style="margin-top:20px;">';
        content += '<p class="modal-caption"><strong>Step 2: Automated Self-Healing:</strong> Auto Scaling Group Activity History confirms automatic launch of replacement instance <code>i-093b7bb19bdcd64e5</code>. Continuous HTTP tests confirmed 100% 200 OK client availability throughout.</p>';
        break;

      case "data-evidence":
      case "tradeoffs":
        content = '<h3 class="modal-title">Relational Persistence &amp; SSM Parameter Store Verification</h3>';
        content += '<img src="./assets/screenshots/rds-details.png" alt="RDS MySQL Multi-AZ Details in AWS Console">';
        content += '<p class="modal-caption"><strong>RDS MySQL Multi-AZ:</strong> Production database instance (<code>db.t3.micro</code>, MySQL Community 8.0) in us-east-2. Multi-AZ is enabled with synchronous replication to AZ-2b standby. Publicly accessible is set to No.</p>';
        content += '<img src="./assets/screenshots/ssm-parameter.png" alt="Systems Manager Parameter Store in AWS Console" style="margin-top:20px;">';
        content += '<p class="modal-caption"><strong>AWS Systems Manager Parameter Store:</strong> Decoupled configuration holding <code>/duokart/dev/db-password</code>, <code>/duokart/dev/db-user</code>, and <code>/duokart/dev/db-name</code>.</p>';
        content += '<div class="tradeoff-box" style="margin-top:20px;">';
        content += '<h4>Architectural Trade-Off: CloudFormation &amp; SSM Parameter Store</h4>';
        content += '<p><strong>SSM Parameter Constraint:</strong> CloudFormation <code>AWS::SSM::Parameter</code> only supports String and StringList enum values (rejects SecureString). Reverted template parameter to String and locked read access strictly to the EC2 IAM role with a least-privilege IAM policy.</p>';
        content += '</div>';
        break;

      case "async-evidence":
      case "order-e2e":
        content = '<h3 class="modal-title">Asynchronous Queue, Lambda Worker &amp; DynamoDB Verification</h3>';
        content += '<img src="./assets/screenshots/sqs-queue.png" alt="SQS Queues List in AWS Console">';
        content += '<p class="modal-caption"><strong>Amazon SQS Queue:</strong> High-throughput ingestion queue <code>duokart-orders</code> paired with Dead-Letter Queue <code>duokart-orders-dlq</code> (maxReceiveCount: 3) for poison message isolation.</p>';
        content += '<img src="./assets/screenshots/lambda-worker.png" alt="AWS Lambda Worker in AWS Console" style="margin-top:20px;">';
        content += '<p class="modal-caption"><strong>AWS Lambda Worker:</strong> Python 3.12 worker triggered by SQS events with batch size 1 to process orders asynchronously.</p>';
        content += '<img src="./assets/screenshots/dynamodb-table.png" alt="DynamoDB Table in AWS Console" style="margin-top:20px;">';
        content += '<p class="modal-caption"><strong>DynamoDB State Table:</strong> Table <code>duokart-orders</code> with primary key <code>orderId</code>, supporting conditional state updates (RECEIVED &rarr; PACKING).</p>';
        content += '<img src="./assets/screenshots/order-e2e.png" alt="PowerShell curl to ALB endpoint" style="margin-top:20px;">';
        content += '<p class="modal-caption"><strong>Terminal Execution:</strong> PowerShell <code>Invoke-RestMethod</code> sending POST /orders to ALB DNS returning <code>202 RECEIVED</code>, transitioning to <code>PACKING 297</code> after 15 seconds.</p>';
        content += '<img src="./assets/screenshots/order-e2e-mail_2.png" alt="SNS email notification received in Gmail" style="margin-top:20px;">';
        content += '<p class="modal-caption"><strong>Verified SNS Email Receipt:</strong> AWS SNS email notification delivered to Gmail mailbox with order JSON payload.</p>';
        break;

      case "storage-evidence":
      case "storage-tradeoff":
        content = '<h3 class="modal-title">Amazon S3 Direct Uploads &amp; Security Governance Verification</h3>';
        content += '<img src="./assets/screenshots/s3-presigned-url.png" alt="Direct presigned S3 PUT terminal receipt">';
        content += '<p class="modal-caption"><strong>Presigned PUT Terminal Receipt:</strong> Browser uploads directly to Amazon S3 via cryptographically signed presigned URLs with SHA-256 checksums, keeping heavy binary files completely off the Flask compute tier.</p>';
        content += '<img src="./assets/screenshots/s3-photo-blocked-all.png" alt="S3 Block Public Access console" style="margin-top:20px;">';
        content += '<p class="modal-caption"><strong>S3 Public Access Block:</strong> All 4 block public access settings enabled on <code>duokart-photos</code> to prevent accidental public data leaks.</p>';
        content += '<img src="./assets/screenshots/s3-photo-lifecycle30d.png" alt="S3 Lifecycle rule console" style="margin-top:20px;">';
        content += '<p class="modal-caption"><strong>S3 Lifecycle Rule:</strong> 30-day automated expiration rule configured on buckets to prevent storage costs from accumulating over time.</p>';
        content += '<div class="tradeoff-box" style="margin-top:20px;">';
        content += '<h4>Architectural Trade-Off: S3 Object Lock vs Lifecycle Expiration</h4>';
        content += '<p><strong>Nightly Cleanup Guard:</strong> Object Lock compliance mode (ps-18 bucket) blocked automated nightly deletion scripts during testing. Transitioned to versioned bucket with 30-day lifecycle expiration (ps-19) to strictly honor the $20 project budget ceiling.</p>';
        content += '</div>';
        break;

      case "ops-evidence":
      case "dashboard":
      case "alarms":
        content = '<h3 class="modal-title">CloudWatch Operational Dashboard &amp; 8 Production Alarms</h3>';
        content += '<img src="./assets/screenshots/dashboard.png" alt="CloudWatch dashboard for duokart-dev">';
        content += '<p class="modal-caption"><strong>Central Telemetry Control Room:</strong> Full <code>duokart-dev</code> dashboard in us-east-2: Requests vs 5xx errors, ALB host health (2 healthy targets), RDS CPU and free storage trend, SQS message age, DLQ poison depth, Lambda duration, and DynamoDB throttles.</p>';
        content += '<img src="./assets/screenshots/alarms-list.png" alt="CloudWatch 8 alarms list in AWS Console" style="margin-top:20px;">';
        content += '<p class="modal-caption"><strong>8 Metric Alarms:</strong> Proactive alarms in us-east-2 configured to alert via SNS before buyers experience latency or errors.</p>';
        content += '<img src="./assets/screenshots/budget.png" alt="AWS Budgets console" style="margin-top:20px;">';
        content += '<p class="modal-caption"><strong>AWS Budgets Governance:</strong> $20.00 monthly cap with automated email alerts at 60% actual spend ($12.00) and 100% forecast spend ($20.00).</p>';
        break;

      case "budget":
        content = '<h3 class="modal-title">AWS Budgets &amp; Cost Control Console</h3>';
        content += '<img src="./assets/screenshots/budget.png" alt="AWS Budgets console showing $20 limit and alert thresholds">';
        content += '<p class="modal-caption"><strong>Budget Configuration:</strong> $20.00 monthly cap in us-east-2. Automated email alerts configured at 60% actual spend ($12.00) and 100% forecast spend ($20.00). Total project build cost was held to ~$20 to $25.</p>';
        break;

      case "schematic":
      default:
        content = '<h3 class="modal-title">Full-Resolution Architecture Schematic</h3>';
        content += '<img src="./assets/architecture.png" alt="DuoKart High-Resolution AWS Architecture">';
        content += '<p class="modal-caption">Multi-tier topology across 2 Availability Zones in us-east-2: ALB, Auto Scaling EC2, Multi-AZ RDS MySQL, S3, SQS with DLQ, Lambda 3.12, DynamoDB, SNS, and CloudWatch.</p>';
        break;
    }

    modalBody.innerHTML = content;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  if (modalClose) {
    modalClose.addEventListener("click", closeModal);
  }

  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal && modal.classList.contains("open")) {
      closeModal();
    }
  });

  // -------------------------------------------------------------------------
  // 4. Subsystem Tabs Event Delegation
  // -------------------------------------------------------------------------
  var tabButtons = document.querySelectorAll(".sub-tab-btn");
  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabButtons.forEach(function (b) {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      var subKey = btn.getAttribute("data-sub");
      renderSubsystem(subKey);
    });
  });

  // Initial render: default to compute
  renderSubsystem("compute");

  // -------------------------------------------------------------------------
  // 5. Console Proofs Card Click Handlers
  // -------------------------------------------------------------------------
  var receiptCards = document.querySelectorAll(".receipt-box");
  receiptCards.forEach(function (card) {
    card.addEventListener("click", function () {
      var key = card.getAttribute("data-receipt");
      openEvidenceModal(key);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Generic Evidence Modal Triggers Across Page
  // -------------------------------------------------------------------------
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-modal-target]");
    if (trigger) {
      e.preventDefault();
      var key = trigger.getAttribute("data-modal-target");
      openEvidenceModal(key);
    }
  });

  // -------------------------------------------------------------------------
  // 7. Architecture Diagram Scale & Lightbox
  // -------------------------------------------------------------------------
  var toggleFlowBtn = document.getElementById("btn-toggle-flow");
  var mainSchematic = document.getElementById("main-schematic");
  var expandDiagramBtn = document.getElementById("btn-expand-diagram");

  if (toggleFlowBtn && mainSchematic) {
    toggleFlowBtn.addEventListener("click", function () {
      if (mainSchematic.style.maxHeight === "none") {
        mainSchematic.style.maxHeight = "540px";
        mainSchematic.style.objectFit = "contain";
        toggleFlowBtn.textContent = "Fit to Viewport";
      } else {
        mainSchematic.style.maxHeight = "none";
        mainSchematic.style.objectFit = "unset";
        toggleFlowBtn.textContent = "Reset Scale";
      }
    });
  }

  if (expandDiagramBtn) {
    expandDiagramBtn.addEventListener("click", function () {
      openEvidenceModal("schematic");
    });
  }

  // -------------------------------------------------------------------------
  // 8. Mobile Navigation Drawer Toggle
  // -------------------------------------------------------------------------
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var isExpanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", !isExpanded);
      navLinks.classList.toggle("open");
    });

    // Close menu when a link is clicked
    var links = navLinks.querySelectorAll("a");
    links.forEach(function (l) {
      l.addEventListener("click", function () {
        navToggle.setAttribute("aria-expanded", "false");
        navLinks.classList.remove("open");
      });
    });
  }

  // -------------------------------------------------------------------------
  // 9. Interactive Order Flow Playground (In-Browser Contract Simulation)
  // -------------------------------------------------------------------------
  var orderStore = {};

  function el(id) {
    return document.getElementById(id);
  }

  function setOutput(id, obj, code) {
    var target = el(id);
    if (!target) return;
    target.textContent = (code ? code + " " : "") + JSON.stringify(obj, null, 2);
  }

  function renderTimeline(steps) {
    var all = ["RECEIVED", "PACKING", "DONE"];
    var ul = el("timeline");
    if (!ul) return;
    ul.innerHTML = "";
    all.forEach(function (s) {
      var li = document.createElement("li");
      var isDone = steps.indexOf(s) >= 0;
      li.textContent = (isDone ? "[DONE] " : "[WAIT] ") + s;
      if (isDone) li.className = "done";
      ul.appendChild(li);
    });
  }

  var orderForm = el("order-form");
  if (orderForm) {
    orderForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var orderId = el("f-id").value.trim();
      var qty = parseInt(el("f-qty").value, 10);
      var price = parseInt(el("f-price").value, 10);
      var total = parseInt(el("f-total").value, 10);
      var changed = el("f-changed").checked;

      if (!orderId || !(qty > 0) || !(price >= 0) || !(total >= 0)) {
        setOutput("order-out", { error: "INVALID", message: "orderId/qty/price/total required" }, "400");
        return;
      }

      if (total !== qty * price) {
        setOutput("order-out", { error: "TOTAL_MISMATCH", message: "total does not match qty x price (" + qty + " * " + price + " = " + (qty * price) + ")" }, "400");
        return;
      }

      var canon = JSON.stringify({ orderId: orderId, qty: qty, price: price, total: total });
      if (orderStore[orderId] && (changed || orderStore[orderId].canon !== canon)) {
        setOutput("order-out", { error: "CONFLICT", message: "same id, different data (idempotency guard)" }, "409");
        return;
      }

      orderStore[orderId] = { status: "RECEIVED", total: total, canon: canon };
      setOutput("order-out", { orderId: orderId, status: "RECEIVED" }, "202");
      renderTimeline(["RECEIVED"]);

      var mailOwner = el("mail-owner");
      var mailBuyer = el("mail-buyer");
      if (mailOwner) mailOwner.textContent = "Pending worker dispatch...";
      if (mailBuyer) mailBuyer.textContent = "";

      setTimeout(function () {
        if (!orderStore[orderId]) return;
        orderStore[orderId].status = "PACKING";
        setOutput("order-out", { orderId: orderId, status: "PACKING", total: total }, "200");
        renderTimeline(["RECEIVED", "PACKING"]);
        if (mailOwner) mailOwner.textContent = "SNS Owner Alert: New order " + orderId + " RECEIVED (" + qty + " items @ " + price + ")";
        if (mailBuyer) mailBuyer.textContent = "SNS Buyer Alert: Order " + orderId + " is PACKING. Total: " + total;
      }, 2000);
    });
  }

  var lookupForm = el("lookup-form");
  if (lookupForm) {
    lookupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = el("f-get").value.trim();
      if (!orderStore[id]) {
        setOutput("get-out", { error: "NOT_FOUND", message: "Order id not found in memory store" }, "404");
        return;
      }
      setOutput("get-out", { orderId: id, status: orderStore[id].status, total: orderStore[id].total }, "200");
    });
  }

  var deliverBtn = el("deliver");
  if (deliverBtn) {
    deliverBtn.addEventListener("click", function () {
      var id = el("f-id").value.trim();
      if (!orderStore[id]) {
        setOutput("order-out", { error: "NOT_FOUND", message: "Submit order first before marking delivered" }, "404");
        return;
      }
      if (orderStore[id].status !== "PACKING") {
        setOutput("order-out", { orderId: id, status: orderStore[id].status, note: "Order must reach PACKING state before DELIVERED" }, "200");
        return;
      }
      orderStore[id].status = "DONE";
      setOutput("order-out", { orderId: id, status: "DONE" }, "200");
      renderTimeline(["RECEIVED", "PACKING", "DONE"]);
      var mailBuyer = el("mail-buyer");
      if (mailBuyer) mailBuyer.textContent = "SNS Buyer Alert: Order " + id + " has been DELIVERED.";
    });
  }

})();
