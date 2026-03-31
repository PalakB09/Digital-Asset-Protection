"""
Pytest configuration for MediaShield tests.
"""
import pytest
import asyncio


@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


def pytest_configure(config):
    """Set asyncio mode to auto."""
    config.addinivalue_line("markers", "asyncio: mark a test as an asyncio test.")
