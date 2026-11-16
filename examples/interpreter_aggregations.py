"""Select readings and calculate totals in an ordinary report."""


class Reading:
    def __init__(self, name, value):
        self.name = name
        self.value = value

    def __repr__(self):
        return "Reading" + repr((self.name, self.value))


def magnitude(reading):
    return reading.value


def values(readings):
    for reading in readings:
        yield reading.value


readings = [Reading("first", 1.5), Reading("second", 2.5), Reading("third", 2.5)]
report = {
    "smallest": min(readings, key=magnitude),
    "largest": max(readings, key=magnitude),
    "total": sum(values(readings)),
}
print(report)
print("first tie", report["largest"] is readings[1])
print("compensated", sum([1e16, 1.0, -1e16]))
print("empty", min([], default=None), sum([], start=0.0))
