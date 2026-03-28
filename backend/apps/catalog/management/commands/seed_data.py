"""
Management command to seed the database with demo data.

Creates:
  - 2 creator users
  - 10 sessions (mix of draft/published, future/past dates)
  - 20 bookings by a regular user
"""

import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.catalog.models import Booking, Session

try:
    from faker import Faker

    FAKER_AVAILABLE = True
except ImportError:
    FAKER_AVAILABLE = False

User = get_user_model()

SESSION_TITLES = [
    "Introduction to Python Programming",
    "Advanced React Patterns",
    "Machine Learning Fundamentals",
    "Docker & Kubernetes Deep Dive",
    "Photography for Beginners",
    "Watercolour Painting Workshop",
    "Public Speaking Masterclass",
    "Financial Planning 101",
    "Yoga & Mindfulness Session",
    "Creative Writing Workshop",
]

SESSION_DESCRIPTIONS = [
    "A hands-on session covering the fundamentals with real-world examples.",
    "Deep dive into advanced concepts with Q&A and live coding.",
    "Interactive workshop with exercises and practical takeaways.",
    "Expert-led session with case studies and best practices.",
    "Beginner-friendly introduction with step-by-step guidance.",
]


class Command(BaseCommand):
    help = "Seed the database with demo creators, sessions, and bookings."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing seed data before creating new data.",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            self.stdout.write("Clearing existing seed data...")
            Session.objects.all().delete()
            User.objects.filter(username__startswith="creator_seed_").delete()
            User.objects.filter(username__startswith="user_seed_").delete()

        # Skip entirely if seed data already exists (idempotent on restarts)
        if not options["clear"] and Session.objects.exists():
            self.stdout.write("Seed data already present — skipping.")
            return

        fake = Faker() if FAKER_AVAILABLE else None
        now = timezone.now()

        # --- Creators ---
        creators = []
        for i in range(1, 3):
            username = f"creator_seed_{i}"
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"creator{i}@example.com",
                    "first_name": "Creator" if not fake else fake.first_name(),
                    "last_name": f"{i}" if not fake else fake.last_name(),
                    "role": "CREATOR",
                },
            )
            if created:
                user.set_password("testpass123")
                user.save()
                self.stdout.write(f"  Created creator: {username}")
            creators.append(user)

        # --- Regular users (multiple so we can create 20 bookings) ---
        regular_users = []
        for i in range(1, 5):
            u, created = User.objects.get_or_create(
                username=f"user_seed_{i}",
                defaults={
                    "email": f"user{i}@example.com",
                    "first_name": "User" if not fake else fake.first_name(),
                    "last_name": f"{i}" if not fake else fake.last_name(),
                    "role": "USER",
                },
            )
            if created:
                u.set_password("testpass123")
                u.save()
                self.stdout.write(f"  Created regular user: user_seed_{i}")
            regular_users.append(u)

        # --- Sessions ---
        sessions_created = []
        statuses = [
            Session.Status.PUBLISHED,
            Session.Status.PUBLISHED,
            Session.Status.DRAFT,
        ]

        for idx, title in enumerate(SESSION_TITLES):
            creator = creators[idx % len(creators)]
            sess_status = random.choice(statuses)
            # Mix future and past dates
            days_offset = random.randint(-7, 30)
            scheduled_at = now + timedelta(
                days=days_offset, hours=random.randint(9, 17)
            )
            price = round(random.uniform(10, 200), 2)
            capacity = random.randint(5, 30)
            description = (
                random.choice(SESSION_DESCRIPTIONS)
                if not fake
                else fake.paragraph(nb_sentences=3)
            )

            session, created = Session.objects.get_or_create(
                title=title,
                creator=creator,
                defaults={
                    "description": description,
                    "price": price,
                    "scheduled_at": scheduled_at,
                    "duration_minutes": random.choice([30, 60, 90, 120]),
                    "capacity": capacity,
                    "status": sess_status,
                },
            )
            if created:
                sessions_created.append(session)
                self.stdout.write(f'  Created session: "{title}" [{sess_status}]')

        # --- Bookings ---
        published_sessions = list(
            Session.objects.filter(status=Session.Status.PUBLISHED)
        )
        bookings_created = 0
        attempts = 0

        while bookings_created < 20 and attempts < 80:
            attempts += 1
            if not published_sessions:
                break
            session = random.choice(published_sessions)
            user = random.choice(regular_users)
            if Booking.objects.filter(session=session, user=user).exists():
                continue

            Booking.objects.create(
                session=session,
                user=user,
                status=Booking.Status.CONFIRMED,
            )
            bookings_created += 1
            self.stdout.write(f'  Created booking: {user.username} → "{session.title}"')
            # Remove fully-booked sessions
            if session.is_full:
                published_sessions.remove(session)

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone! Created {len(sessions_created)} sessions and {bookings_created} bookings."
            )
        )
