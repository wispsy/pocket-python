"""Render ordinary report records with float and recursive container displays."""


class Reading:
    def __init__(self, name, value):
        self.name = name
        self.value = value

    def __repr__(self):
        return "Reading" + repr((self.name, self.value))


readings = [Reading("temperature", 21.5), Reading("pressure", 1e-5)]
report = {"readings": readings, "limits": (0.0, 1e16), "ready": True}
print(report)
print("shared", [readings, readings])
history = [report]
history.append(history)
print("history", history)
